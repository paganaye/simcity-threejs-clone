import * as THREE from "three";
import { IOrientation2D } from "../sim/IPoint";
import type { IRoad, IRoadType } from "./roads/IRoad";
import { RoadBuilder } from "./RoadBuilder";
import { getBands } from "./RoadLayout";


export class TwoWayRoadBuilder implements IOrientation2D {
    x: number;
    y: number;
    z: number;
    angle: number;
    textureProgressV: number = 0;

    static materialByStyle = new Map<string, THREE.MeshStandardMaterial>();

    constructor(startPosition: IOrientation2D, readonly scene: THREE.Object3D) {
        this.x = startPosition.x;
        this.y = startPosition.y ?? 0;
        this.z = startPosition.z;
        this.angle = startPosition.angle;
    }

    advanceRoad(length: number, road: IRoad, _cuts: any = {}) {
        let left: IRoadType | null;
        let right: IRoadType;

        const safeGap = Number.isFinite(road.gapSize) ? road.gapSize : 0;
        right = road.forward;
        left = road.backward ?? null;

        if (length <= 0) return;
        const leftBands = left ? getBands(left) : null;
        const rightBands = getBands(right);

        const rightWidthM = rightBands.totalWidthM;
        const leftWidthM = leftBands ? leftBands.totalWidthM : 0;
        const halfGapM = left ? safeGap / 2 : 0;
        const dx = Math.cos(this.angle) * length;
        const dz = -Math.sin(this.angle) * length;
        const normalX = Math.sin(this.angle);
        const normalZ = Math.cos(this.angle);
        const repeat = length / RoadBuilder.LINE_LENGTH;
        const startV = this.textureProgressV;
        const endV = startV + repeat;
        // const rightShouldStretch = RoadBuilder.hasEntryExitKerb(right);
        // const leftShouldStretch = RoadBuilder.hasEntryExitKerb(left);
        const rightUvArray = [0, startV, 0, endV, 1, startV, 1, endV];
        const leftUvArray = [1, startV, 1, endV, 0, startV, 0, endV];

        const centerX = this.x + dx / 2;
        const centerZ = this.z + dz / 2;

        const sharedParams = { length, center: { x: centerX, y: this.y, z: centerZ, angle: this.angle }, normal: { x: normalX, z: normalZ }, scene: this.scene };

        // Gap is geometric only: place each half-road away from center by halfGapM.
        RoadBuilder.createStraightRoadMesh({ ...sharedParams, halfOffsetM: halfGapM + rightWidthM / 2, widthM: rightWidthM, uvArray: rightUvArray, roadType: right });
        if (left) RoadBuilder.createStraightRoadMesh({ ...sharedParams, halfOffsetM: -(halfGapM + leftWidthM / 2), widthM: leftWidthM, uvArray: leftUvArray, roadType: left });

        this.x += dx;
        this.z += dz;
        this.textureProgressV = endV;
    }

    // addCurvedRoad(turnAngle: number, radius: number, road: IRoad, _cuts: any) {
    //     const rightBands = getBands(road.forward);
    //     const leftBands = road.backward ? getBands(road.backward) : null;

    //     let left: IRoadOptions | null;
    //     let right: IRoadOptions;
    //     let gap: number;
    //     right = road.forward;
    //     left = road.backward ?? null;
    //     gap = left && Number.isFinite(road.gapSize) ? road.gapSize : 0;

    //     if (Math.abs(turnAngle) < 0.001) return;

    //     const DEBUG_ROAD_ARC = true;

    //     if (DEBUG_ROAD_ARC) {
    //         console.log('[RoadBuilder.turn] input', {
    //             roadType: left ? 'two-way' : 'one-way',
    //             turnAngle,
    //             radius,
    //             x: this.x,
    //             z: this.z,
    //             angle: this.angle,
    //             gap,
    //         });
    //     }

    //     const segments = Math.max(1, Math.round(Math.abs(RoadBuilder.TURNING_SEGMENTS_MULTIPLIER * turnAngle)));
    //     const initialRoadAngle = this.angle;
    //     const finalRoadAngle = initialRoadAngle + turnAngle;
    //     const centerCalcDirection = turnAngle > 0 ? -1 : 1;
    //     const cx = this.x + Math.sin(initialRoadAngle) * radius * centerCalcDirection;
    //     const cz = this.z + Math.cos(initialRoadAngle) * radius * centerCalcDirection;
    //     const geomAngleOffset = turnAngle > 0 ? -Math.PI / 2 : +Math.PI / 2;
    //     const totalCurveAngle = Math.abs(turnAngle);
    //     const curveLength = radius * totalCurveAngle;
    //     const startV = this.textureProgressV;
    //     this.textureProgressV = startV + curveLength / RoadBuilder.LINE_LENGTH;

    //     const sharedCurveParams = { gap, turnAngle, segments, radius, totalCurveAngle, startV, arcCenter: { x: cx, y: this.y, z: cz }, initialRoadAngle, geomAngleOffset, scene: this.scene };

    //     if (DEBUG_ROAD_ARC) {
    //         console.log('[RoadBuilder.turn] side right', { widthM: rightBands.totalWidthM, lanes: right.lanes });
    //         if (left && leftBands) console.log('[RoadBuilder.turn] side left', { widthM: leftBands.totalWidthM, lanes: left.lanes });
    //     }

    //     if (left && leftBands) RoadBuilder.createCurvedRoadMesh({ ...sharedCurveParams, side: 'left', options: left, bands: leftBands! });
    //     RoadBuilder.createCurvedRoadMesh({ ...sharedCurveParams, side: 'right', options: right, bands: rightBands! });

    //     this.angle = finalRoadAngle;
    //     const finalGeometryRayAngle = finalRoadAngle + geomAngleOffset;
    //     this.x = cx + Math.cos(finalGeometryRayAngle) * radius;
    //     this.z = cz - Math.sin(finalGeometryRayAngle) * radius;

    //     if (DEBUG_ROAD_ARC) {
    //         console.log('[RoadBuilder.turn] output', {
    //             finalAngle: this.angle,
    //             finalX: this.x,
    //             finalZ: this.z,
    //             centerX: cx,
    //             centerZ: cz,
    //             geomAngleOffset,
    //         });
    //     }
    // }

}
