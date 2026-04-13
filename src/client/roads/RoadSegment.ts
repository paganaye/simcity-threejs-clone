import * as THREE from 'three';
import type { IRoadCuts } from './RoadCuts';
import type { IRoad, IRoadType } from './IRoad';
import { RoadPrimitive } from './RoadPrimitive';
import { getBands } from './RoadLayout';
import { StraightRoadPrimitive } from './StraightRoadPrimitive';
import { CurvedRoadPrimitive } from './CurvedRoadPrimitive';
import { IPoint2D } from '../../sim/IPoint';

const DEBUG_ROAD_ARC = true;

export type SegmentSide = 'start' | 'end';

export interface SegmentEndPoint {
    segment: RoadSegment;
    side: SegmentSide;
}
/**
 * A single straight road segment.
 * The group sits at (startX, 0, startZ) with rotation.y = angle.
 * Road geometry is built at local origin with angle=0;
 * the group's rotation handles world direction so moving/rotating
 * the group (via gizmo) needs no geometry rebuild.
 */
export class RoadSegment {
    private static nextId = 1;
    readonly id = RoadSegment.nextId++;
    readonly group = new THREE.Group();
    private iRoad: IRoad = {
        forward: { roadColor: 'old', lanes: 1, rightKerb: 'none', rightSidewalk: 'small', laneWidth: 'normal', leftKerb: 'none', leftSidewalk: 'none' },
        backward: { roadColor: 'old', lanes: 1, rightKerb: 'none', rightSidewalk: 'small', laneWidth: 'normal', leftKerb: 'none', leftSidewalk: 'none' },
        gapSize: 0
    };

    // Arc control point (world space). When set, road is rebuilt as a curve.
    private _arcMidX?: number;
    private _arcMidZ?: number;
    // Stored end position when arc is active (world space).
    private _arcEndX?: number;
    private _arcEndZ?: number;
    private _angle: number;
    private _length: number;
    private junctionCuts?: { forwardCuts?: IRoadCuts; backwardCuts?: IRoadCuts };
    forwardPrimitive!: RoadPrimitive;
    backwardPrimitive?: RoadPrimitive;
    startJoinArcPrimitive?: RoadPrimitive;
    endJoinArcPrimitive?: RoadPrimitive;

    constructor(
        private readonly sceneRoot: THREE.Object3D,
        start: IPoint2D,
        end: IPoint2D,
        initialRoad?: IRoad,
    ) {
        this.startX = start.x;
        this.startZ = start.z;
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        this._angle = Math.atan2(-dz, dx);
        this._length = Math.hypot(dx, dz);

        if (initialRoad) {
            this.iRoad = {
                forward: { ...initialRoad.forward },
                backward: initialRoad.backward ? { ...initialRoad.backward } : undefined,
                gapSize: Number.isFinite(initialRoad.gapSize) ? initialRoad.gapSize : 0
            };
        }
        this.group.userData.selectableType = 'road';
        this.group.userData.roadSegment = this;
        this.group.userData.iRoad = this.iRoad;
        this.group.position.set(this.startX, 0, this.startZ);
        this.group.rotation.y = this.angle;
        sceneRoot.add(this.group);
        this.rebuild();
    }

    public startX: number;
    public startZ: number;

    get start(): SegmentEndPoint {
        return { side: 'start', segment: this };
    }
    get end(): SegmentEndPoint {
        return { side: 'end', segment: this };
    }

    get angle(): number {
        return this._angle;
    }

    get length(): number {
        return this._length;
    }

    get endX(): number {
        return this._arcEndX ?? this.startX + Math.cos(this.angle) * this.length;
    }

    get endZ(): number {
        return this._arcEndZ ?? this.startZ - Math.sin(this.angle) * this.length;
    }

    get arcMidX(): number | undefined { return this._arcMidX; }
    get arcMidZ(): number | undefined { return this._arcMidZ; }

    getIRoad(): IRoad {
        return this.iRoad;
    }

    setIRoad(nextRoad: IRoad): void {
        this.iRoad = {
            forward: { ...nextRoad.forward },
            backward: nextRoad.backward ? { ...nextRoad.backward } : undefined,
            gapSize: Number.isFinite(nextRoad.gapSize) ? nextRoad.gapSize : 0,
        };
        this.group.userData.iRoad = this.iRoad;
        this.rebuild();
    }

    setJunctionCuts(cuts?: { forwardCuts?: IRoadCuts; backwardCuts?: IRoadCuts }): void {
        this.junctionCuts = cuts;
        this.rebuild();
    }

    getJunctionCuts(): { forwardCuts?: IRoadCuts; backwardCuts?: IRoadCuts } | undefined {
        return this.junctionCuts;
    }

    clearTransientJoinArcPrimitives(): void {
        this.startJoinArcPrimitive = undefined;
        this.endJoinArcPrimitive = undefined;
    }

    setTransientJoinArc(side: SegmentSide, params: {
        id: string;
        direction: 'forward' | 'backward';
        start: IPoint2D;
        mid: IPoint2D;
        end: IPoint2D;
        roadType: IRoadType;
        cuts?: IRoadCuts;
    }): void {
        const primitive = new CurvedRoadPrimitive({
            parent: this.group,
            transient: true,
            start: params.start,
            mid: params.mid,
            end: params.end,
            roadType: params.roadType,
            cuts: params.cuts,
        });
        if (side === 'start') {
            this.startJoinArcPrimitive = primitive;
            return;
        }

        this.endJoinArcPrimitive = primitive;
    }

    private compilePrimitives(): void {
        this.forwardPrimitive = undefined as any;
        this.backwardPrimitive = undefined as any;

        const forwardCuts = this.junctionCuts?.forwardCuts;
        const backwardCuts = this.junctionCuts?.backwardCuts;

        const start = { x: this.startX, z: this.startZ };
        const end = { x: this.endX, z: this.endZ };

        if (
            this._arcMidX !== undefined &&
            this._arcMidZ !== undefined &&
            this._arcEndX !== undefined &&
            this._arcEndZ !== undefined
        ) {
            const mid = { x: this._arcMidX, z: this._arcMidZ };
            this.forwardPrimitive = new CurvedRoadPrimitive({
                parent: this.group,
                transient: false,
                start,
                mid,
                end,
                roadType: this.iRoad.forward,
                cuts: forwardCuts,
            });

            if (this.iRoad.backward) {
                this.backwardPrimitive = new CurvedRoadPrimitive({
                    parent: this.group,
                    transient: false,
                    start: end,
                    mid,
                    end: start,
                    roadType: this.iRoad.backward,
                    cuts: backwardCuts,
                });
            }
            return;
        }

        this.forwardPrimitive = new StraightRoadPrimitive({
            parent: this.group,
            transient: false,
            start,
            end,
            roadType: this.iRoad.forward,
            cuts: forwardCuts,
        });

        if (this.iRoad.backward) {
            this.backwardPrimitive = new StraightRoadPrimitive({
                parent: this.group,
                transient: false,
                start: end,
                end: start,
                roadType: this.iRoad.backward,
                cuts: backwardCuts,
            });
        }
    }

    /** Curve the road through a world-space control point. Keeps start and end fixed. */
    setArc(midX: number, midZ: number, endX?: number, endZ?: number, forceArc = false): void {
        if (endX !== undefined && endZ !== undefined) {
            this._arcEndX = endX;
            this._arcEndZ = endZ;
        } else if (this._arcEndX === undefined || this._arcEndZ === undefined) {
            this._arcEndX = this.startX + Math.cos(this.angle) * this.length;
            this._arcEndZ = this.startZ - Math.sin(this.angle) * this.length;
        }

        const targetEndX = this._arcEndX;
        const targetEndZ = this._arcEndZ;
        if (targetEndX === undefined || targetEndZ === undefined) return;

        // If arc control returns near the straight chord, switch back to true straight mode.
        // Transient join arcs may force curved mode to preserve small-angle round corners.
        const chordDx = targetEndX - this.startX;
        const chordDz = targetEndZ - this.startZ;
        const chordLength = Math.hypot(chordDx, chordDz);
        if (!forceArc && chordLength > 1e-6) {
            const ux = chordDx / chordLength;
            const uz = chordDz / chordLength;
            const nx = -uz;
            const nz = ux;
            const mx = midX - this.startX;
            const mz = midZ - this.startZ;
            const perpendicularDistance = Math.abs(mx * nx + mz * nz);
            const straightThreshold = Math.max(0.2, chordLength * 0.02);

            if (perpendicularDistance <= straightThreshold) {
                this.#setStraightFromEndpoints(targetEndX, targetEndZ);
                this.rebuild();
                return;
            }
        }

        this._arcMidX = midX;
        this._arcMidZ = midZ;
        this.rebuild();
    }

    #setStraightFromEndpoints(endX: number, endZ: number): void {
        const dx = endX - this.startX;
        const dz = endZ - this.startZ;
        this._length = Math.hypot(dx, dz);
        this._angle = Math.atan2(-dz, dx);
        this._arcMidX = undefined;
        this._arcMidZ = undefined;
        this._arcEndX = undefined;
        this._arcEndZ = undefined;
    }

    /** Move without rebuilding geometry — group transform handles world position. */
    moveTo(startX: number, startZ: number, angle: number): void {
        this.startX = startX;
        this.startZ = startZ;
        this._angle = angle;
        this._arcMidX = undefined;
        this._arcMidZ = undefined;
        this._arcEndX = undefined;
        this._arcEndZ = undefined;
        this.group.position.set(startX, 0, startZ);
        this.group.rotation.y = angle;
        this.compilePrimitives();
    }

    /** Change length and rebuild geometry. Clears any arc. */
    resize(newLength: number): void {
        this._arcMidX = undefined;
        this._arcMidZ = undefined;
        this._arcEndX = undefined;
        this._arcEndZ = undefined;
        this._length = newLength;
        this.rebuild();
    }

    /** Rebuild road meshes. Uses arc if control point is set, straight road otherwise. */
    rebuild(): void {
        this.#clearGeometry();

        if (this._arcMidX !== undefined && this._arcMidZ !== undefined &&
            this._arcEndX !== undefined && this._arcEndZ !== undefined) {
            this.#rebuildArc(this._arcMidX, this._arcMidZ, this._arcEndX, this._arcEndZ);
        } else {
            this.group.position.set(this.startX, 0, this.startZ);
            this.group.rotation.y = this.angle;
            this.#addStraightMeshes(this.length, this.junctionCuts);
        }

        this.#tagChildren();
        this.compilePrimitives();
    }

    dispose(): void {
        this.#clearGeometry();
        this.sceneRoot.remove(this.group);
    }

    #clearGeometry(): void {
        while (this.group.children.length > 0) {
            const child = this.group.children[0] as THREE.Mesh;
            if (child.geometry) child.geometry.dispose();
            this.group.remove(child);
        }
    }

    #tagChildren(): void {
        this.group.traverse((obj) => {
            if (obj !== this.group) {
                obj.userData.selectableType = 'road';
                obj.userData.roadSegment = this;
            }
        });
    }

    /**
     * Rebuild as a circular arc through (startX,startZ), mid, end.
     * The group is placed at world-space identity so builder coords are world coords.
     */
    #rebuildArc(midX: number, midZ: number, endX: number, endZ: number): void {
        const p1x = this.startX, p1z = this.startZ;
        const p2x = midX, p2z = midZ;
        const p3x = endX, p3z = endZ;

        // Circumcircle of three world points.
        const D = 2 * (p1x * (p2z - p3z) + p2x * (p3z - p1z) + p3x * (p1z - p2z));
        if (Math.abs(D) < 0.01) {
            if (DEBUG_ROAD_ARC) {
                console.log('[RoadArc] fallback-straight', {
                    segmentId: this.group.id,
                    determinant: D,
                });
            }
            // Points nearly collinear — fall back to straight road.
            this.#setStraightFromEndpoints(p3x, p3z);
            this.group.position.set(this.startX, 0, this.startZ);
            this.group.rotation.y = this.angle;
            this.#addStraightMeshes(this.length, this.junctionCuts);
            return;
        }

        const w1 = p1x * p1x + p1z * p1z;
        const w2 = p2x * p2x + p2z * p2z;
        const w3 = p3x * p3x + p3z * p3z;
        const cx = (w1 * (p2z - p3z) + w2 * (p3z - p1z) + w3 * (p1z - p2z)) / D;
        const cz = (w1 * (p3x - p2x) + w2 * (p1x - p3x) + w3 * (p2x - p1x)) / D;
        const radius = Math.hypot(p1x - cx, p1z - cz);

        // Compute angles in builder-space (x, -z) to match RoadBuilder conventions.
        const a1 = Math.atan2(-(p1z - cz), p1x - cx);
        const a2 = Math.atan2(-(p2z - cz), p2x - cx);
        const a3 = Math.atan2(-(p3z - cz), p3x - cx);

        const normalizeSigned = (angle: number): number => {
            let a = angle;
            while (a > Math.PI) a -= 2 * Math.PI;
            while (a <= -Math.PI) a += 2 * Math.PI;
            return a;
        };

        const positiveDelta = (from: number, to: number): number => {
            let d = to - from;
            while (d < 0) d += 2 * Math.PI;
            while (d >= 2 * Math.PI) d -= 2 * Math.PI;
            return d;
        };

        const negativeDelta = (from: number, to: number): number => {
            let d = from - to;
            while (d < 0) d += 2 * Math.PI;
            while (d >= 2 * Math.PI) d -= 2 * Math.PI;
            return d;
        };

        // Candidate 1: shortest signed arc from start to end.
        const shortDelta = normalizeSigned(a3 - a1);
        // Candidate 2: opposite wrapping arc with same endpoints.
        const longDelta = shortDelta > 0 ? shortDelta - 2 * Math.PI : shortDelta + 2 * Math.PI;

        const isOnArc = (start: number, mid: number, delta: number): boolean => {
            if (delta > 0) {
                const total = positiveDelta(start, start + delta);
                const toMid = positiveDelta(start, mid);
                return toMid <= total + 1e-6;
            }
            const total = negativeDelta(start, start + delta);
            const toMid = negativeDelta(start, mid);
            return toMid <= total + 1e-6;
        };

        let turnAngle = isOnArc(a1, a2, shortDelta) ? shortDelta : longDelta;
        if (!isOnArc(a1, a2, turnAngle)) {
            // Fallback for numeric edge-cases: prefer the shortest arc.
            turnAngle = shortDelta;
        }

        const startAngle = a1 + (turnAngle > 0 ? Math.PI / 2 : -Math.PI / 2);
        const arcAngle = Math.abs(turnAngle);


        // Build at world-space identity so builder positions are world coordinates.
        this.group.position.set(0, 0, 0);
        this.group.rotation.set(0, 0, 0);

        this.#addCurvedMeshes(p1x, p1z, startAngle, turnAngle, radius);

        // Keep stored state consistent with the arc geometry.
        this._angle = startAngle;
        this._length = arcAngle * radius;
    }

    /** Add straight road meshes into this.group (local coords: start at origin, angle=0). */
    #addStraightMeshes(length: number, cuts?: { forwardCuts?: IRoadCuts; backwardCuts?: IRoadCuts }): void {
        const { forward, backward, gapSize } = this.iRoad;
        const safeGap = Number.isFinite(gapSize) ? gapSize : 0;
        const rightBands = getBands(forward);
        const leftBands = backward ? getBands(backward) : null;
        const halfGapM = backward ? safeGap / 2 : 0;

        const shiftByNormal = (start: IPoint2D, end: IPoint2D, lateralOffsetM: number) => {
            const dx = end.x - start.x;
            const dz = end.z - start.z;
            const angle = Math.atan2(-dz, dx);
            const normalX = Math.sin(angle);
            const normalZ = Math.cos(angle);
            return {
                start: { x: start.x + normalX * lateralOffsetM, y: start.y, z: start.z + normalZ * lateralOffsetM },
                end: { x: end.x + normalX * lateralOffsetM, z: end.z + normalZ * lateralOffsetM },
            };
        };

        const fwdOffsetM = halfGapM + rightBands.totalWidthM / 2;
        const fwdBaseStart = { x: 0, y: 0.015, z: 0 };
        const fwdBaseEnd = { x: length, z: 0 };
        const fwdPoints = shiftByNormal(fwdBaseStart, fwdBaseEnd, fwdOffsetM);

        this.forwardPrimitive = new StraightRoadPrimitive({
            parent: this.group,
            transient: false,
            start: fwdPoints.start,
            end: fwdPoints.end,
            roadType: forward,
            cuts: cuts?.forwardCuts,
        });

        if (backward && leftBands) {
            const bwdOffsetM = halfGapM + leftBands.totalWidthM / 2;
            const bwdBaseStart = { x: length, y: 0.015, z: 0 };
            const bwdBaseEnd = { x: 0, z: 0 };
            const bwdPoints = shiftByNormal(bwdBaseStart, bwdBaseEnd, bwdOffsetM);

            this.backwardPrimitive = new StraightRoadPrimitive({
                parent: this.group,
                transient: false,
                start: bwdPoints.start,
                end: bwdPoints.end,
                roadType: backward,
                cuts: cuts?.backwardCuts,
            });

        }
    }

    /**
     * Add curved road meshes into this.group.
     * Coordinates are world-space — group must be at identity when calling this.
     */
    #addCurvedMeshes(startX: number, startZ: number, startAngle: number, turnAngle: number, radius: number): void {
        const { forward, backward, gapSize } = this.iRoad;
        const safeGap = backward && Number.isFinite(gapSize) ? gapSize : 0;
        const halfGapM = backward ? safeGap / 2 : 0;
        const rightBands = getBands(forward);
        const leftBands = backward ? getBands(backward) : null;

        const createArcPrimitive = (params: {
            start: { x: number; y?: number; z: number; angle: number };
            radius: number;
            sweepAngle: number;
            roadType: IRoadType;
            cuts?: IRoadCuts;
            direction: 'forward' | 'backward';
        }): CurvedRoadPrimitive | null => {
            const safeRadius = Math.max(0.001, Math.abs(params.radius));
            const safeSweepAngle = Number.isFinite(params.sweepAngle) ? params.sweepAngle : 0;
            if (Math.abs(safeSweepAngle) < 1e-6) return null;

            const leftNormalX = Math.sin(params.start.angle);
            const leftNormalZ = Math.cos(params.start.angle);
            const turnDirection = safeSweepAngle < 0 ? -1 : 1;
            const center = {
                x: params.start.x + leftNormalX * safeRadius * turnDirection,
                z: params.start.z + leftNormalZ * safeRadius * turnDirection,
            };

            const curveSweepAngle = -safeSweepAngle;
            const radialSign = -turnDirection;
            const pointAt = (t: number) => {
                const tangentAngle = params.start.angle + curveSweepAngle * t;
                const leftN = { x: Math.sin(tangentAngle), z: Math.cos(tangentAngle) };
                return {
                    x: center.x + leftN.x * radialSign * safeRadius,
                    z: center.z + leftN.z * radialSign * safeRadius,
                };
            };

            return new CurvedRoadPrimitive({
                parent: this.group,
                transient: false,
                start: pointAt(0),
                mid: pointAt(0.5),
                end: pointAt(1),
                roadType: params.roadType,
                cuts: params.cuts,
            });
        };

        const sweepAngle = -turnAngle;
        const turnDirection = sweepAngle < 0 ? -1 : 1;
        const leftNormalX = Math.sin(startAngle);
        const leftNormalZ = Math.cos(startAngle);

        const fwdOffsetM = halfGapM + rightBands.totalWidthM / 2;
        const fwdRadius = radius - fwdOffsetM * turnDirection;
        if (fwdRadius > 0.01) {
            const fwdPrimitive = createArcPrimitive({
                start: {
                    x: startX + leftNormalX * fwdOffsetM,
                    y: 0.015,
                    z: startZ + leftNormalZ * fwdOffsetM,
                    angle: startAngle,
                },
                radius: fwdRadius,
                sweepAngle,
                roadType: forward,
                direction: 'forward',
            });
            fwdPrimitive?.refreshMesh();
        }

        if (backward && leftBands) {
            const endAngle = startAngle + turnAngle;
            const centerX = startX + leftNormalX * radius * turnDirection;
            const centerZ = startZ + leftNormalZ * radius * turnDirection;
            const endLeftNormalX = Math.sin(endAngle);
            const endLeftNormalZ = Math.cos(endAngle);
            const endX = centerX - endLeftNormalX * radius * turnDirection;
            const endZ = centerZ - endLeftNormalZ * radius * turnDirection;

            const bwdSweep = turnAngle;
            const bwdTurnDirection = bwdSweep < 0 ? -1 : 1;
            const bwdStartAngle = endAngle + Math.PI;
            const bwdLeftNormalX = Math.sin(bwdStartAngle);
            const bwdLeftNormalZ = Math.cos(bwdStartAngle);
            const bwdOffsetM = halfGapM + leftBands.totalWidthM / 2;
            const bwdRadius = radius - bwdOffsetM * bwdTurnDirection;

            if (bwdRadius > 0.01) {
                const bwdPrimitive = createArcPrimitive({
                    start: {
                        x: endX + bwdLeftNormalX * bwdOffsetM,
                        y: 0.015,
                        z: endZ + bwdLeftNormalZ * bwdOffsetM,
                        angle: bwdStartAngle,
                    },
                    radius: bwdRadius,
                    sweepAngle: bwdSweep,
                    roadType: backward,
                    direction: 'backward',
                });
                bwdPrimitive?.refreshMesh();
            }
        }
    }

}
