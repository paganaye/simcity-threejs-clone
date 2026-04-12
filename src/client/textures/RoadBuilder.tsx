import * as THREE from "three";
import { BandPainter } from "./BandPainter";
import { getBands } from "../roads/RoadLayout";
import type { IRoadType } from "../roads/IRoad";
import type { IOrientation2D } from "../../sim/IPoint";
import { Lane } from "./RoadBand";
import { StraightRoadPrimitive } from "../roads/StraightRoadPrimitive";
import { CurvedRoadPrimitive } from "../roads/CurvedRoadPrimitive";

export interface ISideCuts {
    from: number; // sidewalk start cut
    roadFrom: number;
    roadTo: number;
    to: number; // sidewalk end cut
}

export interface IExtremityCut {
    left: number;
    roadLeft: number;
    roadRight: number;
    right: number;
}

export interface IRoadCuts {
    rightCuts?: ISideCuts[];
    leftCuts?: ISideCuts[];
    startCut?: IExtremityCut;
    endCut?: IExtremityCut;
}

export class RoadBuilder {
    textureProgressV: number = 0;

    static materialByStyle = new Map<string, THREE.MeshStandardMaterial>();

    static LINE_LENGTH = 8; // every 8 metres, which is a common length for dashed lines and also works well for solid lines.
    static OLD_ROAD_COLOR = 'hsl(0, 2%, 7%)';
    static NEW_ROAD_COLOR = 'hsl(0, 2%, 3.5%)';
    static TEXTURE_PPM = 10; // 1 pixel = 0.1m = 10 cm
    static SIDEWALK_COLOR = 'hsl(230, 3%, 40.0%)';
    static GRASS_COLOR = 'hsl(120, 40%, 40%)';
    static YELLOW_LINE = 'hsl(66, 38.70%, 46.70%)';
    static WHITE_LINE = 'hsl(66, 10.0%, 86.70%)';
    static NARROW_LANE_WIDTH_M = 3.0;
    static NORMAL_LANE_WIDTH_M = 3.5;
    static WIDE_LANE_WIDTH_M = 4.25;
    static TRANSPARENT = 'transparent';

    static GRASS_WIDTH_M = 1; // metre
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
    static currentX: number;


    static metersToPixels(meters: number): number {
        return meters * this.TEXTURE_PPM;
    }

    static getLaneWidthMeters(laneWidth: 'narrow' | 'normal' | 'wide'): number {
        switch (laneWidth) {
            case 'narrow': return this.NARROW_LANE_WIDTH_M;
            case 'wide': return this.WIDE_LANE_WIDTH_M;
            default: return this.NORMAL_LANE_WIDTH_M;
        }
    }

    static getEntryExitWidthMeters(laneWidth: Lane): number {
        return this.getLaneWidthMeters(laneWidth) + this.YELLOW_LINE_WIDTH_M;
    }

    static getKerbWidthMeters(kerb: IRoadType['rightKerb'], _laneWidth: Lane): number {
        switch (kerb) {
            case 'parallelParking': return this.PARALLEL_PARKING_WIDTH_M;
            case 'perpendicularParking': return this.PERPENDICULAR_PARKING_WIDTH_M;
            case 'emergencyLane': return this.YELLOW_LINE_WIDTH_M + this.EMERGENCY_LANE_WIDTH_M;
            case 'line': return this.YELLOW_LINE_WIDTH_M + this.YELLOW_LINE_WIDTH_M;
            default: return 0;
        }
    }

    static getSidewalkWidthMeters(sidewalk: IRoadType['rightSidewalk']): number {
        switch (sidewalk) {
            case 'small':
            case 'large': return this.LARGE_SIDEWALK_M;
            default: return 0;
        }
    }

    private constructor() { }

    static styleKey(roadType: IRoadType): string {
        return [
            roadType.roadColor,
            roadType.lanes,
            roadType.rightSidewalk,
            roadType.rightKerb,
            roadType.laneWidth,
            roadType.leftKerb,
            roadType.leftSidewalk
        ].join('|');
    }

    static createStraightRoad(
        params: {
            start: IOrientation2D;
            scene: THREE.Object3D;
            length: number;
            roadType?: IRoadType;
            style?: IRoadType;
            textureProgressV?: number;
            cuts?: IRoadCuts;
            offsetM?: number;
        }): void {
        const { start, scene, length, textureProgressV = 0, cuts, offsetM = 0 } = params;
        const options = params.roadType ?? params.style;
        if (!options) return;
        if (length <= 0) return;
        const dx = Math.cos(start.angle) * length;
        const dz = -Math.sin(start.angle) * length;

        const primitive = new StraightRoadPrimitive({
            transient: false,
            direction: 'forward',
            start: { x: start.x, z: start.z },
            end: { x: start.x + dx, z: start.z + dz },
            roadType: options,
            cuts,
        });
        const mesh = primitive.createMesh({
            material: this.getRoadMaterial(options),
            y: start.y ?? 0,
            textureProgressV,
            lineLength: this.LINE_LENGTH,
            offsetM,
        });
        if (mesh) {
            scene.add(mesh);
        }
    }

    static createArcRoad(params: {
        start: IOrientation2D;
        radius: number;
        sweepAngle: number;
        scene: THREE.Object3D;
        roadType?: IRoadType;
        style?: IRoadType;
        cuts?: IRoadCuts;
        textureProgressV?: number;
        segments?: number;
        segmentLength?: number;
    }): void {
        const {
            start,
            radius,
            sweepAngle,
            scene,
            cuts: _cuts,
            textureProgressV = 0,
            segments,
            segmentLength = 2,
        } = params;
        const options = params.roadType ?? params.style;
        if (!options) return;

        const safeRadius = Math.max(0.001, Math.abs(radius));
        const safeSweepAngle = Number.isFinite(sweepAngle) ? sweepAngle : 0;
        if (Math.abs(safeSweepAngle) < 1e-6) return;

        const leftNormalX = Math.sin(start.angle);
        const leftNormalZ = Math.cos(start.angle);
        const turnDirection = safeSweepAngle < 0 ? -1 : 1;
        const center = {
            x: start.x + leftNormalX * safeRadius * turnDirection,
            z: start.z + leftNormalZ * safeRadius * turnDirection,
        };

        const curveSweepAngle = -safeSweepAngle;
        const radialSign = -turnDirection;
        const pointAt = (t: number) => {
            const tangentAngle = start.angle + curveSweepAngle * t;
            const leftN = { x: Math.sin(tangentAngle), z: Math.cos(tangentAngle) };
            return {
                x: center.x + leftN.x * radialSign * safeRadius,
                z: center.z + leftN.z * radialSign * safeRadius,
            };
        };

        const primitive = new CurvedRoadPrimitive({
            transient: false,
            direction: 'forward',
            start: pointAt(0),
            mid: pointAt(0.5),
            end: pointAt(1),
            roadType: options,
            cuts: params.cuts,
        });
        const mesh = primitive.createMesh({
            material: this.getRoadMaterial(options),
            y: start.y ?? 0,
            textureProgressV,
            lineLength: this.LINE_LENGTH,
            segmentLength: segments ? (safeRadius * Math.abs(curveSweepAngle)) / Math.max(2, segments) : segmentLength,
        });
        if (mesh) {
            scene.add(mesh);
        }
    }

    // static createCurvedRoadMesh(params: {
    //     side: 'left' | 'right';
    //     options: IRoadOptions;
    //     bands: IRoadBands;
    //     gap: number;
    //     turnAngle: number;
    //     segments: number;
    //     radius: number;
    //     totalCurveAngle: number;
    //     startV: number;
    //     arcCenter: IPoint3D;
    //     initialRoadAngle: number;
    //     geomAngleOffset: number;
    //     scene: THREE.Object3D;
    // }): void {
    //     const { side, options, bands, gap, turnAngle, segments, radius, totalCurveAngle, startV, arcCenter, initialRoadAngle, geomAngleOffset, scene } = params;
    //     const widthM = bands.totalWidthM;
    //     if (widthM <= 0) return;
    //     const halfGapM = gap / 2;
    //     const turnSideSign = turnAngle >= 0 ? 1 : -1;
    //     const innerOffset = (side === 'right' ? halfGapM : -halfGapM) * turnSideSign;
    //     const outerOffset = side === 'right'
    //         ? (halfGapM + widthM) * turnSideSign
    //         : -(halfGapM + widthM) * turnSideSign;

    //     const getCurvePoint = (t: number, offsetRadius: number) => {
    //         const currentTangentAngle = initialRoadAngle + t * turnAngle;
    //         const geometryRayAngle = currentTangentAngle + geomAngleOffset;
    //         const cosRay = Math.cos(geometryRayAngle);
    //         const sinRay = Math.sin(geometryRayAngle);
    //         return {
    //             x: arcCenter.x + cosRay * (radius + offsetRadius),
    //             z: arcCenter.z - sinRay * (radius + offsetRadius),
    //         };
    //     };

    //     const vertices: number[] = [];
    //     const uvsSide: number[] = [];
    //     for (let i = 0; i <= segments; i++) {
    //         const t = i / segments;
    //         const innerPoint = getCurvePoint(t, innerOffset);
    //         const outerPoint = getCurvePoint(t, outerOffset);
    //         vertices.push(innerPoint.x, arcCenter.y, innerPoint.z);
    //         vertices.push(outerPoint.x, arcCenter.y, outerPoint.z);
    //         const v = (radius * totalCurveAngle * t) / RoadBuilder.LINE_LENGTH;
    //         const vv = startV + v;
    //         uvsSide.push(0, vv);
    //         uvsSide.push(1, vv);
    //     }

    //     const geometry = new THREE.BufferGeometry();
    //     geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    //     geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvsSide, 2));

    //     const indices: number[] = [];
    //     for (let i = 0; i < segments; i++) {
    //         const a = i * 2;
    //         const b = a + 1;
    //         const c = a + 2;
    //         const d = a + 3;
    //         indices.push(a, b, d);
    //         indices.push(a, d, c);
    //     }
    //     geometry.setIndex(indices);
    //     geometry.computeVertexNormals();

    //     const mesh = new THREE.Mesh(geometry, this.getRoadMaterial(options));
    //     scene.add(mesh);
    // }

    static getRoadMaterial(roadType: IRoadType): THREE.MeshStandardMaterial {
        const key = this.styleKey(roadType);
        const existing = this.materialByStyle.get(key);
        if (existing) {
            return existing;
        }

        const texture = this.createRoadTexture(roadType);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
        });
        this.materialByStyle.set(key, material);
        // material.wireframe = true;
        return material;
    }

    static createRoadTexture(options: IRoadType) {

        const canvas = document.createElement('canvas');
        const layout = getBands(options);
        const textureWidthPx = this.metersToPixels(layout.totalWidthM);
        const textureHeightPx = this.metersToPixels(this.TEXTURE_HEIGHT_M);
        canvas.width = textureWidthPx;
        canvas.height = textureHeightPx;
        const ctx = canvas.getContext('2d')!;
        const painter = new BandPainter(ctx, options);


        painter.drawBands(layout.bands);

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

        RoadBuilder.showTextureInBody(canvas);
        return texture;
    }

    static texY = 20;

    static showTextureInBody(canvas: HTMLCanvasElement) {
        const imageDataURL = canvas.toDataURL('image/png');
        const imgElement = document.createElement('img');

        // Définir ses attributs et styles
        imgElement.src = imageDataURL;
        imgElement.style.position = 'fixed';
        imgElement.style.top = this.texY + 'px'; // Ou une autre position
        this.texY += (canvas.height + 10); // Décale la prochaine image pour éviter le chevauchement
        imgElement.style.left = (80 + (document.querySelectorAll('img[id^="debugCanvasImage"]').length * (canvas.width + 10))) + 'px'; // Décale les images
        imgElement.style.zIndex = '200'; // Pour s'assurer qu'elle est au-dessus

        // Ajouter l'élément image au body (ou à un conteneur spécifique si vous préférez)
        document.body.appendChild(imgElement);

        //document.body.innerHTML += `<img style="position:fixed; top:20px; left:80px;" src="${imageDataURL}" >`;

    }


}
