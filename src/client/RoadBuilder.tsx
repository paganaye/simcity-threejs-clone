import * as THREE from "three";
import { IOrientation2D } from "../sim/IPoint";
import { IFloorPos } from "./GameUIComponent";
import type { IRoad } from "./roads/IRoad";
import {
    iRoadToRenderOptions,
    roadTypeToRenderOptions,
    type RoadRenderOptions,
    type RoadType,
} from "./roads/RoadTypeAdapter";

export type { RoadType } from "./roads/RoadTypeAdapter";
export { roadTypeToIRoad, iRoadToLegacyRoadType } from "./roads/RoadTypeAdapter";

export class RoadBuilder implements IOrientation2D {
    x: number;
    y: number;
    z: number;
    angle: number;
    textureProgressV: number = 0;

    static materialByStyle = new Map<string, THREE.MeshStandardMaterial>();

    static LINE_REPEAT_PER_UNIT = 2;
    static OLD_ROAD_COLOR = 'hsl(0, 2%, 7%)';
    static NEW_ROAD_COLOR = 'hsl(0, 2%, 3.5%)';
    static SMALL_SIDEWALK = 8;
    static LARGE_SIDEWALK = 16;
    static SIDEWALK_COLOR = 'hsl(230, 3%, 40.0%)';
    static YELLOW_LINE = 'hsl(66, 38.70%, 46.70%)';
    static YELLOW_LINE_WIDTH = 2;
    static WHITE_LINE = 'hsl(66, 10.0%, 86.70%)';
    static PAVEMENT_WIDTH = 12;
    static ROAD_WIDTH_UNITS = 10; // in metre
    static TEXTURE_HEIGHT = 32;
    static ROAD_WIDTH = 18;
    static TRANSPARENT = 'transparent';

    static DEFAULT_SHOULDER_WIDTH = 20;
    static EMERGENCY_LANE_WIDTH = 16;
    static PARKING_COLOR = 'hsl(0, 2.70%, 7.30%)';
    static PARALLEL_PARKING_WIDTH = 12;
    static PERPENDICULAR_PARKING_WIDTH = 20;

    static TURNING_SEGMENTS_MULTIPLIER = 3;

    static computeTextureWidth(options: RoadRenderOptions): number {
        let width = 0;
        switch (options.dividing) {
            case 'yellowLineSolid': case 'yellowLineDashed': case 'gap':
                width += this.YELLOW_LINE_WIDTH; break;
        }
        const lanes = Math.max(0, options.lanes);
        width += lanes * this.ROAD_WIDTH;
        if (lanes > 1) width += (lanes - 1) * this.YELLOW_LINE_WIDTH;
        switch (options.shoulder) {
            case 'parallelParking':      width += this.PARALLEL_PARKING_WIDTH; break;
            case 'perpendicularParking': width += this.PERPENDICULAR_PARKING_WIDTH; break;
            case 'emergencyLane':        width += this.YELLOW_LINE_WIDTH + this.EMERGENCY_LANE_WIDTH; break;
            case 'line':                 width += this.YELLOW_LINE_WIDTH + this.YELLOW_LINE_WIDTH; break;
            case 'gap':                  width += this.YELLOW_LINE_WIDTH; break;
        }
        switch (options.sidewalk) {
            case 'small': width += this.SMALL_SIDEWALK; break;
            case 'large': width += this.LARGE_SIDEWALK; break;
        }
        return Math.max(1, width);
    }


    constructor(startPosition: IOrientation2D, readonly scene: THREE.Object3D) {
        this.x = startPosition.x;
        this.y = startPosition.y ?? 0;
        this.z = startPosition.z;
        this.angle = startPosition.angle;
    }

    static styleKey(options: RoadRenderOptions): string {
        return [
            options.roadColor,
            options.lanes,
            options.shoulder,
            options.sidewalk,
            options.dividing,
        ].join('|');
    }

    static getRoadMaterial(options: RoadRenderOptions): THREE.MeshStandardMaterial {
        const key = this.styleKey(options);
        const existing = this.materialByStyle.get(key);
        if (existing) {
            return existing;
        }

        const texture = this.createRoadTexture(options);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
        });
        this.materialByStyle.set(key, material);
        return material;
    }

    static createRoadTexture(options: RoadRenderOptions) {

        const canvas = document.createElement('canvas');
        const textureWidth = this.computeTextureWidth(options);
        canvas.width = textureWidth;
        canvas.height = this.TEXTURE_HEIGHT;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = this.TRANSPARENT;
        ctx.fillRect(0, 0, textureWidth, this.TEXTURE_HEIGHT);

        const drawRoad = (style: RoadRenderOptions) => {
            let currentX = 0;
            let roadColor = style.roadColor === 'new' ? RoadBuilder.NEW_ROAD_COLOR : RoadBuilder.OLD_ROAD_COLOR;

            const drawLine = (
                width: number,
                y: number,
                height: number,
                color: string) => {
                ctx.fillStyle = color;
                ctx.fillRect(currentX, y * this.TEXTURE_HEIGHT, width, height * this.TEXTURE_HEIGHT);
            }
            const drawRectAndIncrement = (width: number, color: string) => {
                drawLine(width, 0, 1, color);
                currentX += width;
            }

            const drawDivide = () => {
                switch (style.dividing) {
                    case 'yellowLineSolid':
                        drawRectAndIncrement(this.YELLOW_LINE_WIDTH, this.YELLOW_LINE);
                        break;
                    case 'yellowLineDashed':
                        drawLine(this.YELLOW_LINE_WIDTH, 0, 0.5, this.YELLOW_LINE);
                        drawLine(this.YELLOW_LINE_WIDTH, 0.5, 1, roadColor);
                        currentX += this.YELLOW_LINE_WIDTH;
                        break;
                    case 'gap':
                        currentX += this.YELLOW_LINE_WIDTH;
                        break;
                    case undefined:
                    case 'none':
                        break;
                    default:
                        throw Error("Divide not implemented yet");
                }
            };

            const drawLanes = () => {
                for (let i = 0; i < style.lanes; i++) {
                    drawRectAndIncrement(this.ROAD_WIDTH, roadColor)
                    if (i < style.lanes - 1) {
                        drawLine(this.YELLOW_LINE_WIDTH, 0, 0.5, this.YELLOW_LINE);
                        drawLine(this.YELLOW_LINE_WIDTH, 0.5, 1, roadColor);
                        currentX += this.YELLOW_LINE_WIDTH;
                    }
                }
            };

            const drawShoulder = () => {

                switch (style.shoulder) {
                    case 'parallelParking':
                        drawLine(this.PARALLEL_PARKING_WIDTH, 0, 1, this.PARKING_COLOR);
                        drawLine(this.PARALLEL_PARKING_WIDTH, 0, 1 / 32, this.WHITE_LINE);
                        drawLine(this.PARALLEL_PARKING_WIDTH, 1 / 2, 1 / 32, this.WHITE_LINE);
                        drawLine(this.YELLOW_LINE_WIDTH, 0, 0.1, this.WHITE_LINE);
                        drawLine(this.YELLOW_LINE_WIDTH, 0.4, 0.2, this.WHITE_LINE);
                        drawLine(this.YELLOW_LINE_WIDTH, 1 - 0.1, 0.1, this.WHITE_LINE);
                        currentX += this.PARALLEL_PARKING_WIDTH;
                        break;
                    case 'perpendicularParking':
                        drawLine(this.PERPENDICULAR_PARKING_WIDTH, 0, 1, this.PARKING_COLOR);
                        drawLine(this.PERPENDICULAR_PARKING_WIDTH, 0, 1 / 32, this.WHITE_LINE);
                        drawLine(this.PERPENDICULAR_PARKING_WIDTH, 1 / 4, 1 / 32, this.WHITE_LINE);
                        drawLine(this.PERPENDICULAR_PARKING_WIDTH, 3 / 4, 1 / 32, this.WHITE_LINE);
                        drawLine(this.PERPENDICULAR_PARKING_WIDTH, 2 / 4, 1 / 32, this.WHITE_LINE);
                        currentX += this.PERPENDICULAR_PARKING_WIDTH;

                        break;
                    case 'emergencyLane':
                        drawRectAndIncrement(this.YELLOW_LINE_WIDTH, this.YELLOW_LINE);
                        drawRectAndIncrement(this.EMERGENCY_LANE_WIDTH, roadColor);
                        break;
                    case 'line':
                        drawRectAndIncrement(this.YELLOW_LINE_WIDTH, this.YELLOW_LINE);
                        drawRectAndIncrement(this.YELLOW_LINE_WIDTH, roadColor);
                        break;
                    case 'gap':
                        drawRectAndIncrement(this.YELLOW_LINE_WIDTH, roadColor);
                        break;

                    case undefined:
                    case 'none':
                        break;
                    default:
                        throw Error("shoulder not implemented yet");
                }
            };

            const drawSidewalk = () => {
                switch (style.sidewalk) {
                    case 'small':
                        drawRectAndIncrement(this.SMALL_SIDEWALK, this.SIDEWALK_COLOR);
                        break;
                    case 'large':
                        drawRectAndIncrement(this.LARGE_SIDEWALK, this.SIDEWALK_COLOR);
                        break;
                    case undefined:
                    case 'none':
                        break;
                    default:
                        throw Error("sidewalk not implemented yet");
                }
            };

            drawDivide();
            drawLanes();
            drawShoulder();
            drawSidewalk();
        };

        drawRoad(options);

        const imageData = ctx.getImageData(0, 0, textureWidth, this.TEXTURE_HEIGHT);
        const data = new Uint8Array(imageData.data);

        const texture = new THREE.DataTexture(
            data,
            textureWidth,
            this.TEXTURE_HEIGHT,
            THREE.RGBAFormat
        );
        texture.needsUpdate = true;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }


    static showTextureInBody(canvas: HTMLCanvasElement) {
        const imageDataURL = canvas.toDataURL('image/png');
        const imgElement = document.createElement('img');

        // Définir ses attributs et styles
        imgElement.src = imageDataURL;
        imgElement.style.position = 'fixed';
        imgElement.style.top = '20px'; // Ou une autre position
        imgElement.style.left = (80 + (document.querySelectorAll('img[id^="debugCanvasImage"]').length * (canvas.width + 10))) + 'px'; // Décale les images
        imgElement.style.zIndex = '200'; // Pour s'assurer qu'elle est au-dessus

        // Ajouter l'élément image au body (ou à un conteneur spécifique si vous préférez)
        document.body.appendChild(imgElement);

        //document.body.innerHTML += `<img style="position:fixed; top:20px; left:80px;" src="${imageDataURL}" >`;

    }
    //     static openTextureInNewWindow(canvas: HTMLCanvasElement) {
    //         const newWindow = window.open('', '_blank');
    //         const imageDataURL = canvas.toDataURL('image/png');

    //         if (newWindow) {
    //             newWindow.document.write(`<img src="${imageDataURL}">`);
    //         } else {
    //             console.error("La fenêtre popup n'a pas pu s'ouvrir. Veuillez vérifier les paramètres de votre navigateur.");
    //         }
    //     }

    //     addSphere(x: number, z: number) {
    //         const geometry = new THREE.SphereGeometry(0.05);
    //         const material = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide });
    //         const sphere = new THREE.Mesh(geometry, material);
    //         sphere.position.set(x, 0, z);
    //         this.scene.add(sphere);
    //     }

    addStraightRoadFromIRoad(length: number, road: IRoad) {
        const render = iRoadToRenderOptions(road);
        this.addStraightRoadWithOptions(length, render.left, render.right);
    }

    addStraightRoad(length: number, leftType: RoadType = 'l1', rightType: RoadType = leftType) {
        this.addStraightRoadWithOptions(length, roadTypeToRenderOptions(leftType), roadTypeToRenderOptions(rightType));
    }

    addStraightRoadWithOptions(length: number, left: RoadRenderOptions, right: RoadRenderOptions) {
        // Don't create geometry for zero or negative length
        if (length <= 0) return;

        const roadWidth = RoadBuilder.ROAD_WIDTH_UNITS;
        const halfRoadWidth = roadWidth / 2;
        const geometry = new THREE.PlaneGeometry(length, roadWidth);
        const dx = Math.cos(this.angle) * length;
        const dz = -Math.sin(this.angle) * length;
        const normalX = Math.sin(this.angle);
        const normalZ = Math.cos(this.angle);
        const repeat = length * RoadBuilder.LINE_REPEAT_PER_UNIT;
        const startV = this.textureProgressV;
        const endV = startV + repeat;
        const rightUvArray = [0, startV, 0, endV, 1, startV, 1, endV];
        const leftUvArray = [1, startV, 1, endV, 0, startV, 0, endV];

        const createRoad = (offsetX: number, offsetZ: number, side: 'left' | 'right', options: RoadRenderOptions) => {
            const roadGeometry = geometry.clone();
            const road = new THREE.Mesh(roadGeometry, RoadBuilder.getRoadMaterial(options));
            road.position.set(
                this.x + dx / 2 + offsetX,
                this.y,
                this.z + dz / 2 + offsetZ
            );
            road.rotation.x = -Math.PI / 2;
            road.rotation.z = this.angle;
            const uvSrc = (side === 'right' ? rightUvArray : leftUvArray).slice();
            roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvSrc, 2));
            this.scene.add(road);
        };

        createRoad(-normalX * halfRoadWidth, -normalZ * halfRoadWidth, 'left', left);
        createRoad(normalX * halfRoadWidth, normalZ * halfRoadWidth, 'right', right);

        this.x += dx;
        this.z += dz;
        this.textureProgressV = endV; // Mise à jour de la progression V
    }

    addTurningRoadFromIRoad(turnAngle: number, radius: number, road: IRoad) {
        const render = iRoadToRenderOptions(road);
        this.addTurningRoadWithOptions(turnAngle, radius, render.left, render.right);
    }

    addTurningRoad(turnAngle: number, radius: number, leftType: RoadType = 'l1', rightType: RoadType = leftType) {
        this.addTurningRoadWithOptions(turnAngle, radius, roadTypeToRenderOptions(leftType), roadTypeToRenderOptions(rightType));
    }

    addTurningRoadWithOptions(turnAngle: number, radius: number, left: RoadRenderOptions, right: RoadRenderOptions) {
        if (Math.abs(turnAngle) < 0.001) return;

        const segments = Math.max(1, Math.round(Math.abs(RoadBuilder.TURNING_SEGMENTS_MULTIPLIER * turnAngle)));
        const initialRoadAngle = this.angle;
        const finalRoadAngle = initialRoadAngle + turnAngle;
        const centerCalcDirection = turnAngle > 0 ? -1 : 1;
        const cx = this.x + Math.sin(initialRoadAngle) * radius * centerCalcDirection;
        const cz = this.z + Math.cos(initialRoadAngle) * radius * centerCalcDirection;
        const geomAngleOffset = turnAngle > 0 ? -Math.PI / 2 : +Math.PI / 2;
        const totalCurveAngle = Math.abs(turnAngle);
        const curveLength = radius * totalCurveAngle;
        const startV = this.textureProgressV;
        const uvs: number[] = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const v = (radius * totalCurveAngle * t) * RoadBuilder.LINE_REPEAT_PER_UNIT;
            uvs.push(0, startV + v);
            uvs.push(1, startV + v);
        }
        this.textureProgressV = startV + curveLength * RoadBuilder.LINE_REPEAT_PER_UNIT;

        const getCurvePoint = (t: number, offsetRadius: number): IFloorPos => {
            const currentTangentAngle = initialRoadAngle + t * turnAngle;
            const geometryRayAngle = currentTangentAngle + geomAngleOffset;
            const cosRay = Math.cos(geometryRayAngle);
            const sinRay = Math.sin(geometryRayAngle);
            const x = cx + cosRay * (radius + offsetRadius);
            const z = cz - sinRay * (radius + offsetRadius);
            return { x, z };
        };

        const addHalfRoad = (side: 'left' | 'right', options: RoadRenderOptions) => {
            const vertices: number[] = [];
            const uvsSide: number[] = [];
            const offsetLeftInner = -RoadBuilder.ROAD_WIDTH_UNITS;
            const offsetLeftOuter = 0;
            const offsetRightInner = 0;
            const offsetRightOuter = RoadBuilder.ROAD_WIDTH_UNITS;

            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const innerPoint = getCurvePoint(t, side == 'left' ? offsetLeftInner : offsetRightInner);
                const outerPoint = getCurvePoint(t, side == 'left' ? offsetLeftOuter : offsetRightOuter);

                vertices.push(innerPoint.x, this.y, innerPoint.z);
                vertices.push(outerPoint.x, this.y, outerPoint.z);

                const v = (radius * totalCurveAngle * t) * RoadBuilder.LINE_REPEAT_PER_UNIT;
                uvsSide.push(side == 'left' ? 1 : 0, startV + v);
                uvsSide.push(side == 'left' ? 0 : 1, startV + v);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvsSide, 2));

            const indices: number[] = [];
            for (let i = 0; i < segments; i++) {
                const a = i * 2;
                const b = a + 1;
                const c = a + 2;
                const d = a + 3;
                indices.push(a, b, d);
                indices.push(a, d, c);
            }
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            const mesh = new THREE.Mesh(geometry, RoadBuilder.getRoadMaterial(options));
            this.scene.add(mesh);
        };

        addHalfRoad("left", left);
        addHalfRoad("right", right);

        this.angle = finalRoadAngle;
        const finalGeometryRayAngle = finalRoadAngle + geomAngleOffset;
        this.x = cx + Math.cos(finalGeometryRayAngle) * radius;
        this.z = cz - Math.sin(finalGeometryRayAngle) * radius;
    }

}
