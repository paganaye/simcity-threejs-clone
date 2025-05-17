import * as THREE from "three";
import { IOrientation2D } from "../sim/IPoint";


type ShoulderType = 'parallelParking' | 'perpendicularParking' | 'emergencyLane' | 'line' | 'gap' | 'none';
type DividingType = 'yellowLineSolid' | 'yellowLineDashed' | 'gap' | 'none';
type SideWalkType = 'small' | 'large' | 'none';

interface IRoadOptions {
    roadColor: 'old' | 'new';
    dividing: DividingType;
    lanes: number;
    shoulder: ShoulderType;
    sidewalk: SideWalkType;
}

export const roadTypes = {
    none: { dividing: 'none', lanes: 0, shoulder: 'none', sidewalk: 'small', roadColor: 'old' },
    l1: { dividing: 'none', lanes: 1, shoulder: 'none', sidewalk: 'small', roadColor: 'old' },
    l2: { dividing: 'none', lanes: 1, shoulder: 'parallelParking', sidewalk: 'small', roadColor: 'old' },
    l3: { dividing: 'none', lanes: 1, shoulder: 'perpendicularParking', sidewalk: 'small', roadColor: 'old' },
    l4: { dividing: 'yellowLineSolid', lanes: 1, shoulder: 'line', sidewalk: 'large', roadColor: 'new' },
    l5: { dividing: 'yellowLineSolid', lanes: 2, shoulder: 'line', sidewalk: 'large', roadColor: 'new' },
    l6: { dividing: 'yellowLineSolid', lanes: 3, shoulder: 'line', sidewalk: 'large', roadColor: 'new' },
    l7: { dividing: 'yellowLineSolid', lanes: 1, shoulder: 'emergencyLane', sidewalk: 'large', roadColor: 'new' },
} satisfies Record<string, IRoadOptions>
let roadTypeIndex: Record<keyof typeof roadTypes, number> = {} as any;

export type RoadType = keyof typeof roadTypes;

export class RoadBuilder implements IOrientation2D {
    x: number;
    y: number;
    z: number;
    angle: number;
    textureProgressV: number = 0;

    static roadTexture: THREE.DataTexture;
    static roadMaterial: THREE.MeshStandardMaterial;

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
    static ROAD_WIDTH_UNITS = 0.6; // in units
    static TEXTURE_HEIGHT = 32;
    static ROAD_WIDTH = 18;
    static TRANSPARENT = 'transparent';

    static DEFAULT_SHOULDER_WIDTH = 20;
    static EMERGENCY_LANE_WIDTH = 16;
    static PARKING_COLOR = 'hsl(0, 2.70%, 7.30%)';
    static PARALLEL_PARKING_WIDTH = 12;
    static PERPENDICULAR_PARKING_WIDTH = 20;

    static TURNING_SEGMENTS_MULTIPLIER = 3;
    static ROAD_VARIANTS = Object.keys(roadTypes).length;
    static UMAX = 1 / RoadBuilder.ROAD_VARIANTS;

    static TEXTURE_WIDTH = 92;


    constructor(startPosition: IOrientation2D, readonly scene: THREE.Scene) {
        this.x = startPosition.x;
        this.y = startPosition.y ?? 0;
        this.z = startPosition.z;
        this.angle = startPosition.angle;
    }

    static {
        this.roadTexture = this.createRoadTexture();
        this.roadMaterial = new THREE.MeshStandardMaterial({
            map: this.roadTexture,
            side: THREE.DoubleSide,
            transparent: true,
        });

    }


    static createRoadTexture() {

        const canvas = document.createElement('canvas');
        let textureWidth = this.TEXTURE_WIDTH * this.ROAD_VARIANTS;
        canvas.width = textureWidth;
        canvas.height = this.TEXTURE_HEIGHT;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = this.TRANSPARENT;
        ctx.fillRect(0, 0, textureWidth, this.TEXTURE_HEIGHT);

        const drawRoad = (roadNo: number, options: IRoadOptions) => {
            const roadStartX = this.TEXTURE_WIDTH * roadNo;
            let currentX = roadStartX;
            let roadColor = options.roadColor === 'new' ? RoadBuilder.NEW_ROAD_COLOR : RoadBuilder.OLD_ROAD_COLOR;

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
                switch (options.dividing) {
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
                for (let i = 0; i < options.lanes; i++) {
                    drawRectAndIncrement(this.ROAD_WIDTH, roadColor)
                    if (i < options.lanes - 1) {
                        drawLine(this.YELLOW_LINE_WIDTH, 0, 0.5, this.YELLOW_LINE);
                        drawLine(this.YELLOW_LINE_WIDTH, 0.5, 1, roadColor);
                        currentX += this.YELLOW_LINE_WIDTH;
                    }
                }
            };

            const drawShoulder = () => {

                switch (options.shoulder) {
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
                switch (options.sidewalk) {
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

        Object.entries(roadTypes).forEach(([name, roadOptions], i) => {
            drawRoad(i, roadOptions);
            roadTypeIndex[name as RoadType] = i
        })

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
        this.showTextureInBody(canvas);
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

    addStraightRoad(length: number, leftType: RoadType = 'l1', rightType: RoadType = leftType) {
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
        const rightUvArray = [0, startV, 0, endV, RoadBuilder.UMAX, startV, RoadBuilder.UMAX, endV];
        const leftUvArray = [RoadBuilder.UMAX, startV, RoadBuilder.UMAX, endV, 0, startV, 0, endV];


        const createRoad = (offsetX: number, offsetZ: number, side: 'left' | 'right', roadType: RoadType) => {
            const roadGeometry = geometry.clone();
            const road = new THREE.Mesh(roadGeometry, RoadBuilder.roadMaterial);
            road.position.set(
                this.x + dx / 2 + offsetX,
                this.y,
                this.z + dz / 2 + offsetZ
            );
            road.rotation.x = -Math.PI / 2;
            road.rotation.z = this.angle;
            let uvSrc = (side === 'right' ? rightUvArray : leftUvArray).slice();
            let textureIndex = roadTypeIndex[roadType] ?? 0;
            let uOffset = textureIndex * RoadBuilder.UMAX;

            const finalUvArray = [];
            for (let i = 0; i < uvSrc.length; i += 2) {
                finalUvArray.push(uvSrc[i] + uOffset, uvSrc[i + 1]);
            }

            roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(finalUvArray, 2));
            this.scene.add(road);
        };

        createRoad(-normalX * halfRoadWidth, -normalZ * halfRoadWidth, 'left', leftType);
        createRoad(normalX * halfRoadWidth, normalZ * halfRoadWidth, 'right', rightType);

        this.x += dx;
        this.z += dz;
        this.textureProgressV = endV; // Mise à jour de la progression V
    }

    addTurningRoad(turnAngle: number, radius: number, leftType: RoadType = 'l1', rightType: RoadType = leftType) {
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
            uvs.push(RoadBuilder.UMAX, startV + v);
        }
        this.textureProgressV = startV + curveLength * RoadBuilder.LINE_REPEAT_PER_UNIT;

        const getCurvePoint = (t: number, offsetRadius: number): { x: number, z: number } => {
            const currentTangentAngle = initialRoadAngle + t * turnAngle;
            const geometryRayAngle = currentTangentAngle + geomAngleOffset;
            const cosRay = Math.cos(geometryRayAngle);
            const sinRay = Math.sin(geometryRayAngle);
            const x = cx + cosRay * (radius + offsetRadius);
            const z = cz - sinRay * (radius + offsetRadius);
            return { x, z };
        };

        const addHalfRoad = (side: 'left' | 'right', roadType: RoadType) => {
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
                uvsSide.push(side == 'left' ? RoadBuilder.UMAX : 0, startV + v);
                uvsSide.push(side == 'left' ? 0 : RoadBuilder.UMAX, startV + v);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

            // Ajout de la gestion du roadType pour les UVs
            const finalUvArray: number[] = [];
            const uvSrc = uvsSide.slice();
            const textureIndex = roadTypeIndex[roadType] ?? 0;
            const uOffset = textureIndex * RoadBuilder.UMAX;

            for (let i = 0; i < uvSrc.length; i += 2) {
                finalUvArray.push(uvSrc[i] + uOffset, uvSrc[i + 1]);
            }
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(finalUvArray, 2));

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

            let mesh = new THREE.Mesh(geometry, RoadBuilder.roadMaterial);
            this.scene.add(mesh);
        };

        addHalfRoad("left", leftType);
        addHalfRoad("right", rightType);

        this.angle = finalRoadAngle;
        const finalGeometryRayAngle = finalRoadAngle + geomAngleOffset;
        this.x = cx + Math.cos(finalGeometryRayAngle) * radius;
        this.z = cz - Math.sin(finalGeometryRayAngle) * radius;
    }

}
