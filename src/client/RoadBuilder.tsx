import * as THREE from "three";
import { IOrientation2D } from "../sim/IPoint";
import { IFloorPos } from "./GameUIComponent";
import type { IRoad } from "./roads/IRoad";
import {
    iRoadToRenderOptions,
    type RoadRenderOptions,
} from "./roads/RoadTypeAdapter";

export type { RoadRenderOptions } from "./roads/RoadTypeAdapter";

export class RoadBuilder implements IOrientation2D {
    x: number;
    y: number;
    z: number;
    angle: number;
    textureProgressV: number = 0;

    static materialByStyle = new Map<string, THREE.MeshStandardMaterial>();

    // One texture (V range [0..1]) represents TEXTURE_HEIGHT_M meters.
    // This avoids overly dense dashed lines.
    static LINE_REPEAT_PER_UNIT = 1 / 8; // every 8 metres, which is a common length for dashed lines and also works well for solid lines.
    static OLD_ROAD_COLOR = 'hsl(0, 2%, 7%)';
    static NEW_ROAD_COLOR = 'hsl(0, 2%, 3.5%)';
    static TEXTURE_PPM = 10; // to be refined
    static SIDEWALK_COLOR = 'hsl(230, 3%, 40.0%)';
    static YELLOW_LINE = 'hsl(66, 38.70%, 46.70%)';
    static WHITE_LINE = 'hsl(66, 10.0%, 86.70%)';
    static NARROW_LANE_WIDTH_M = 3.0;
    static NORMAL_LANE_WIDTH_M = 3.5;
    static WIDE_LANE_WIDTH_M = 4.25;
    static TRANSPARENT = 'transparent';
    static PARKING_COLOR = 'hsl(0, 2.70%, 7.30%)';

    static YELLOW_LINE_WIDTH_M = 0.15; // 15 cm
    static PAVEMENT_WIDTH_M = 1.5; // metre
    static TEXTURE_HEIGHT_M = 8; // This allow us to make 4m discontinous yellow line

    static DEFAULT_SHOULDER_WIDTH_M = 0.5; // 50 cm
    static EMERGENCY_LANE_WIDTH_M = 2; // metre
    static PARALLEL_PARKING_WIDTH_M = 2.4; // metre
    static PERPENDICULAR_PARKING_WIDTH_M = 5.0; // metre
    static SMALL_SIDEWALK_M = 1; // metre
    static LARGE_SIDEWALK_M = 2; // metre

    static TURNING_SEGMENTS_MULTIPLIER = 12;

    static metersToPixels(meters: number): number {
        return Math.round(meters * this.TEXTURE_PPM);
    }

    static getLaneWidthMeters(laneWidth: 'narrow' | 'normal' | 'wide'): number {
        switch (laneWidth) {
            case 'narrow': return this.NARROW_LANE_WIDTH_M;
            case 'wide': return this.WIDE_LANE_WIDTH_M;
            default: return this.NORMAL_LANE_WIDTH_M;
        }
    }

    static getGapWidthMeters(gapSize: number): number {
        // gapSize is the total distance between forward and other ways.
        // Each rendered way gets half of it from the center seam.
        return Math.max(0, gapSize || 0) / 2;
    }

    static getEntryExitWidthMeters(laneWidth: RoadRenderOptions['laneWidth']): number {
        return this.getLaneWidthMeters(laneWidth) + this.YELLOW_LINE_WIDTH_M;
    }

    static getKerbWidthMeters(kerb: RoadRenderOptions['rightKerb'], _laneWidth: RoadRenderOptions['laneWidth']): number {
        switch (kerb) {
            case 'parallelParking': return this.PARALLEL_PARKING_WIDTH_M;
            case 'perpendicularParking': return this.PERPENDICULAR_PARKING_WIDTH_M;
            case 'emergencyLane': return this.YELLOW_LINE_WIDTH_M + this.EMERGENCY_LANE_WIDTH_M;
            case 'line': return this.YELLOW_LINE_WIDTH_M + this.YELLOW_LINE_WIDTH_M;
            case 'gap': return this.YELLOW_LINE_WIDTH_M;
            //case 'entry': return this.getEntryExitWidthMeters(laneWidth);
            //case 'exit': return this.getEntryExitWidthMeters(laneWidth);
            default: return 0;
        }
    }

    // static hasEntryExitKerb(options: RoadRenderOptions): boolean {
    //     return options.leftKerb === 'entry' || options.leftKerb === 'exit'
    //         || options.rightKerb === 'entry' || options.rightKerb === 'exit';
    // }

    static getSidewalkWidthMeters(sidewalk: RoadRenderOptions['rightSidewalk']): number {
        switch (sidewalk) {
            case 'small': return this.SMALL_SIDEWALK_M;
            case 'large': return this.LARGE_SIDEWALK_M;
            default: return 0;
        }
    }

    static computeRoadWidthMeters(options: RoadRenderOptions): number {
        let widthM = 0;
        widthM += this.getKerbWidthMeters(options.leftKerb, options.laneWidth);
        widthM += this.getSidewalkWidthMeters(options.leftSidewalk);
        const laneWidthM = this.getLaneWidthMeters(options.laneWidth);
        const lanes = Math.max(0, options.lanes);
        widthM += lanes * laneWidthM;
        if (lanes > 1) widthM += (lanes - 1) * this.YELLOW_LINE_WIDTH_M;
        widthM += this.getKerbWidthMeters(options.rightKerb, options.laneWidth);
        widthM += this.getSidewalkWidthMeters(options.rightSidewalk);
        return widthM;
    }

    static computeTextureWidthPx(options: RoadRenderOptions): number {
        let w = this.computeRoadWidthMeters(options);
        return Math.max(1, this.metersToPixels(w));
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
            options.rightSidewalk,
            options.rightKerb,
            options.laneWidth,
            options.leftKerb,
            options.leftSidewalk
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
        const textureWidthPx = this.computeTextureWidthPx(options);
        const textureHeightPx = this.metersToPixels(this.TEXTURE_HEIGHT_M);
        canvas.width = textureWidthPx;
        canvas.height = textureHeightPx;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = this.TRANSPARENT;
        ctx.fillRect(0, 0, textureWidthPx, textureHeightPx);

        const drawRoad = (style: RoadRenderOptions) => {
            let currentX = 0;
            let roadColor = style.roadColor === 'new' ? RoadBuilder.NEW_ROAD_COLOR : RoadBuilder.OLD_ROAD_COLOR;

            const drawLine = (
                width: number,
                y: number,
                height: number,
                color: string) => {
                ctx.fillStyle = color;
                ctx.fillRect(currentX, y * textureHeightPx, width, height * textureHeightPx);
            }
            const drawRectAndIncrement = (width: number, color: string) => {
                drawLine(width, 0, 1, color);
                currentX += width;
            }


            const drawKerb = (kerb: RoadRenderOptions['rightKerb'],
                side: 'left' | 'right'
            ) => {


                switch (kerb) {
                    case 'parallelParking':
                        drawLine(this.metersToPixels(this.PARALLEL_PARKING_WIDTH_M), 0, 1, this.PARKING_COLOR);
                        drawLine(this.metersToPixels(this.PARALLEL_PARKING_WIDTH_M), 0, 1 / 32, this.WHITE_LINE);
                        drawLine(this.metersToPixels(this.PARALLEL_PARKING_WIDTH_M), 1 / 2, 1 / 32, this.WHITE_LINE);
                        drawLine(this.metersToPixels(this.YELLOW_LINE_WIDTH_M), 0, 0.1, this.WHITE_LINE);
                        drawLine(this.metersToPixels(this.YELLOW_LINE_WIDTH_M), 0.4, 0.2, this.WHITE_LINE);
                        drawLine(this.metersToPixels(this.YELLOW_LINE_WIDTH_M), 1 - 0.1, 0.1, this.WHITE_LINE);
                        currentX += this.metersToPixels(this.PARALLEL_PARKING_WIDTH_M);
                        break;
                    case 'perpendicularParking':
                        drawLine(this.metersToPixels(this.PERPENDICULAR_PARKING_WIDTH_M), 0, 1, this.PARKING_COLOR);
                        drawLine(this.metersToPixels(this.PERPENDICULAR_PARKING_WIDTH_M), 0, 1 / 32, this.WHITE_LINE);
                        drawLine(this.metersToPixels(this.PERPENDICULAR_PARKING_WIDTH_M), 1 / 4, 1 / 32, this.WHITE_LINE);
                        drawLine(this.metersToPixels(this.PERPENDICULAR_PARKING_WIDTH_M), 3 / 4, 1 / 32, this.WHITE_LINE);
                        drawLine(this.metersToPixels(this.PERPENDICULAR_PARKING_WIDTH_M), 2 / 4, 1 / 32, this.WHITE_LINE);
                        currentX += this.metersToPixels(this.PERPENDICULAR_PARKING_WIDTH_M);
                        break;
                    case 'emergencyLane':
                        drawRectAndIncrement(this.metersToPixels(this.YELLOW_LINE_WIDTH_M), this.YELLOW_LINE);
                        drawRectAndIncrement(this.metersToPixels(this.EMERGENCY_LANE_WIDTH_M), roadColor);
                        break;
                    case 'line':
                        if (side === 'left') {
                            drawRectAndIncrement(this.metersToPixels(this.YELLOW_LINE_WIDTH_M), roadColor);
                            drawRectAndIncrement(this.metersToPixels(this.YELLOW_LINE_WIDTH_M), this.YELLOW_LINE);
                        } else {
                            drawRectAndIncrement(this.metersToPixels(this.YELLOW_LINE_WIDTH_M), this.YELLOW_LINE);
                            drawRectAndIncrement(this.metersToPixels(this.YELLOW_LINE_WIDTH_M), roadColor);
                        }
                        break;
                    case 'gap':
                        drawRectAndIncrement(this.metersToPixels(this.YELLOW_LINE_WIDTH_M), roadColor);
                        break;
                    // case 'entry':
                    //     drawEntryExitDiagonal('entry');
                    //     break;
                    // case 'exit':
                    //     drawEntryExitDiagonal('exit');
                    //     break;
                    case undefined:
                    case 'none':
                        break;
                    default:
                        console.warn(`kerb "${kerb}" not implemented yet.`);
                }
            };

            const drawSidewalk = (sidewalk: RoadRenderOptions['rightSidewalk']) => {
                switch (sidewalk) {
                    case 'small':
                        drawRectAndIncrement(this.metersToPixels(this.SMALL_SIDEWALK_M), this.SIDEWALK_COLOR);
                        break;
                    case 'large':
                        drawRectAndIncrement(this.metersToPixels(this.LARGE_SIDEWALK_M), this.SIDEWALK_COLOR);
                        break;
                    case undefined:
                    case 'none':
                        break;
                    default:
                        throw Error("sidewalk not implemented yet");
                }
            };

            const drawLanes = () => {
                const laneWidth = RoadBuilder.metersToPixels(RoadBuilder.getLaneWidthMeters(style.laneWidth));
                for (let i = 0; i < style.lanes; i++) {
                    drawRectAndIncrement(laneWidth, roadColor)
                    if (i < style.lanes - 1) {
                        drawLine(this.metersToPixels(this.YELLOW_LINE_WIDTH_M), 0, 0.5, this.YELLOW_LINE);
                        drawLine(this.metersToPixels(this.YELLOW_LINE_WIDTH_M), 0.5, 1, roadColor);
                        currentX += this.metersToPixels(this.YELLOW_LINE_WIDTH_M);
                    }
                }
            };

            drawSidewalk(style.leftSidewalk);
            drawKerb(style.leftKerb, 'left');
            drawLanes();
            drawKerb(style.rightKerb, 'right');
            drawSidewalk(style.rightSidewalk);
        };

        drawRoad(options);

        const imageData = ctx.getImageData(0, 0, textureWidthPx, textureHeightPx);
        const data = new Uint8Array(imageData.data);

        const texture = new THREE.DataTexture(
            data,
            textureWidthPx,
            textureHeightPx,
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

    addStraightRoadWithOptions(length: number, left: RoadRenderOptions, right: RoadRenderOptions) {
        // Don't create geometry for zero or negative length
        if (length <= 0) return;

        const rightWidthM = RoadBuilder.computeRoadWidthMeters(right);
        const leftWidthM = RoadBuilder.computeRoadWidthMeters(left);
        const dx = Math.cos(this.angle) * length;
        const dz = -Math.sin(this.angle) * length;
        const normalX = Math.sin(this.angle);
        const normalZ = Math.cos(this.angle);
        const repeat = length * RoadBuilder.LINE_REPEAT_PER_UNIT;
        const startV = this.textureProgressV;
        const endV = startV + repeat;
        // const rightShouldStretch = RoadBuilder.hasEntryExitKerb(right);
        // const leftShouldStretch = RoadBuilder.hasEntryExitKerb(left);
        const rightUvArray = [0, startV, 0, endV, 1, startV, 1, endV];
        const leftUvArray = [0, startV, 0, endV, 1, startV, 1, endV];

        const createRoad = (halfOffsetM: number, widthM: number, side: 'left' | 'right', options: RoadRenderOptions) => {
            if (widthM <= 0) return;
            const roadGeometry = new THREE.PlaneGeometry(length, widthM);
            const road = new THREE.Mesh(roadGeometry, RoadBuilder.getRoadMaterial(options));
            road.position.set(
                this.x + dx / 2 + normalX * halfOffsetM,
                this.y,
                this.z + dz / 2 + normalZ * halfOffsetM
            );
            road.rotation.x = -Math.PI / 2;
            road.rotation.z = this.angle;
            const uvSrc = (side === 'right' ? rightUvArray : leftUvArray).slice();
            roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvSrc, 2));
            this.scene.add(road);
        };

        // Right side starts at seam (0) and extends outward → center at +rightW/2
        // Left side starts at seam (0) and extends outward → center at -leftW/2
        createRoad(+rightWidthM / 2, rightWidthM, 'right', right);
        createRoad(-leftWidthM / 2, leftWidthM, 'left', left);

        this.x += dx;
        this.z += dz;
        this.textureProgressV = endV;
    }

    addTurningRoadFromIRoad(turnAngle: number, radius: number, road: IRoad) {
        const render = iRoadToRenderOptions(road);
        this.addTurningRoadWithOptions(turnAngle, radius, render.left, render.right);
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
            const widthM = RoadBuilder.computeRoadWidthMeters(options);
            if (widthM <= 0) return;
            const vertices: number[] = [];
            const uvsSide: number[] = [];
            // Right: seam at 0, outer edge at +w  (positive = outward from center)
            // Left:  seam at 0, outer edge at -w  (negative = outward from center)
            const innerOffset = 0;
            const outerOffset = side === 'right' ? widthM : -widthM;

            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const innerPoint = getCurvePoint(t, innerOffset);
                const outerPoint = getCurvePoint(t, outerOffset);

                vertices.push(innerPoint.x, this.y, innerPoint.z);
                vertices.push(outerPoint.x, this.y, outerPoint.z);

                const v = (radius * totalCurveAngle * t) * RoadBuilder.LINE_REPEAT_PER_UNIT;
                // const stretchV = t;
                // const useStretch = RoadBuilder.hasEntryExitKerb(options);
                const vv = (startV + v);
                uvsSide.push(0, vv);
                uvsSide.push(1, vv);
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
