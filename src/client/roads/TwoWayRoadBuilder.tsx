import * as THREE from "three";
import { IOrientation2D } from "../../sim/IPoint";
import type { IRoad, IRoadType } from "../roads/IRoad";
import type { IRoadCuts } from "./RoadCuts";
import { RoadBuilder } from "../textures/RoadBuilder";
import { getBands } from "./RoadLayout";
import { StraightRoadPrimitive } from "./StraightRoadPrimitive";
import { CurvedRoadPrimitive } from "./CurvedRoadPrimitive";

const DEBUG_CURVE_BUILD = true;


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

    advanceRoad(length: number, road: IRoad, cuts: { forwardCuts?: IRoadCuts; backwardCuts?: IRoadCuts } = {}) {
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
        const repeat = length / RoadBuilder.LINE_LENGTH;
        const startV = this.textureProgressV;
        const endV = startV + repeat;

        const start = { x: this.x, y: this.y, z: this.z, angle: this.angle };
        const end = { x: this.x + dx, y: this.y, z: this.z + dz, angle: this.angle + Math.PI };

        // Gap is geometric only: place each half-road away from center by halfGapM.
        const rightStraight = StraightRoadPrimitive.createRoadMesh({
            start,
            length,
            roadType: right,
            material: RoadBuilder.getRoadMaterial(right),
            y: this.y,
            textureProgressV: startV,
            cuts: cuts.forwardCuts,
            offsetM: halfGapM + rightWidthM / 2,
        });
        if (rightStraight) {
            this.scene.add(rightStraight);
        }
        if (left) {
            const leftStraight = StraightRoadPrimitive.createRoadMesh({
                start: end,
                length,
                roadType: left,
                material: RoadBuilder.getRoadMaterial(left),
                y: this.y,
                textureProgressV: startV,
                cuts: cuts.backwardCuts,
                offsetM: halfGapM + leftWidthM / 2,
            });
            if (leftStraight) {
                this.scene.add(leftStraight);
            }
        }

        this.x += dx;
        this.z += dz;
        this.textureProgressV = endV;
    }

    addCurvedRoad(turnAngle: number, radius: number, road: IRoad): void {
        if (Math.abs(turnAngle) < 1e-6 || radius <= 0) return;

        const right = road.forward;
        const left = road.backward ?? null;
        const rightBands = getBands(right);
        const leftBands = left ? getBands(left) : null;
        const safeGap = left && Number.isFinite(road.gapSize) ? road.gapSize : 0;
        const halfGapM = left ? safeGap / 2 : 0;

        // createArcRoad uses opposite sweep sign compared to segment turnAngle.
        const sweepAngle = -turnAngle;
        const turnDirection = sweepAngle < 0 ? -1 : 1;
        const leftNormalX = Math.sin(this.angle);
        const leftNormalZ = Math.cos(this.angle);

        const startV = this.textureProgressV;

        const drawOffsetArc = (style: IRoadType, lateralOffsetM: number): void => {
            const offsetStartX = this.x + leftNormalX * lateralOffsetM;
            const offsetStartZ = this.z + leftNormalZ * lateralOffsetM;
            const offsetRadius = radius - lateralOffsetM * turnDirection;
            if (offsetRadius <= 0.01) {
                if (DEBUG_CURVE_BUILD) {
                    console.log('[CurvedRoad] skip-offset-arc', {
                        side: style === right ? 'forward' : 'backward',
                        radius,
                        lateralOffsetM,
                        turnAngle,
                        turnDirection,
                        offsetRadius,
                        gapSize: safeGap,
                    });
                }
                return;
            }

            const rightArc = CurvedRoadPrimitive.createRoadMesh({
                start: { x: offsetStartX, y: this.y, z: offsetStartZ, angle: this.angle },
                radius: offsetRadius,
                sweepAngle,
                roadType: style,
                material: RoadBuilder.getRoadMaterial(style),
                y: this.y,
                textureProgressV: startV,
            });
            if (rightArc) {
                this.scene.add(rightArc);
            }
        };

        const centerX = this.x + leftNormalX * radius * turnDirection;
        const centerZ = this.z + leftNormalZ * radius * turnDirection;
        const endAngle = this.angle + turnAngle;
        const endLeftNormalX = Math.sin(endAngle);
        const endLeftNormalZ = Math.cos(endAngle);
        const endX = centerX - endLeftNormalX * radius * turnDirection;
        const endZ = centerZ - endLeftNormalZ * radius * turnDirection;

        drawOffsetArc(right, halfGapM + rightBands.totalWidthM / 2);

        if (left && leftBands) {
            const backwardSweep = turnAngle;
            const backwardTurnDirection = backwardSweep < 0 ? -1 : 1;
            const backwardStartAngle = endAngle + Math.PI;
            const backwardLeftNormalX = Math.sin(backwardStartAngle);
            const backwardLeftNormalZ = Math.cos(backwardStartAngle);
            const backwardOffsetM = halfGapM + leftBands.totalWidthM / 2;
            const backwardStartX = endX + backwardLeftNormalX * backwardOffsetM;
            const backwardStartZ = endZ + backwardLeftNormalZ * backwardOffsetM;
            const backwardRadius = radius - backwardOffsetM * backwardTurnDirection;

            if (backwardRadius > 0.01) {
                const leftArc = CurvedRoadPrimitive.createRoadMesh({
                    start: { x: backwardStartX, y: this.y, z: backwardStartZ, angle: backwardStartAngle },
                    radius: backwardRadius,
                    sweepAngle: backwardSweep,
                    roadType: left,
                    material: RoadBuilder.getRoadMaterial(left),
                    y: this.y,
                    textureProgressV: startV,
                });
                if (leftArc) {
                    this.scene.add(leftArc);
                }
            } else if (DEBUG_CURVE_BUILD) {
                console.log('[CurvedRoad] skip-backward-arc', {
                    radius,
                    backwardOffsetM,
                    backwardTurnDirection,
                    backwardRadius,
                    turnAngle,
                    gapSize: safeGap,
                });
            }
        }

        this.angle = endAngle;
        this.x = endX;
        this.z = endZ;

        const arcLength = radius * Math.abs(turnAngle);
        this.textureProgressV = startV + arcLength / RoadBuilder.LINE_LENGTH;
    }

}
