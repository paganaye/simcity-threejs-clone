import * as THREE from 'three';
import type { IRoadCuts } from './RoadCuts';
import type { IDualRoadType, IRoadType } from './IRoad';
import { RoadPrimitive } from './RoadPrimitive';
import { StraightRoadPrimitive } from './StraightRoadPrimitive';
import { CurvedRoadPrimitive } from './CurvedRoadPrimitive';
import { getBands } from './RoadLayout';
import { IPoint2D } from '../../sim/IPoint';

const DEBUG_ROAD_ARC = true;

export type SegmentSide = 'start' | 'end';

export interface SegmentEndPoint {
    segment: RoadSegment;
    side: SegmentSide;
}

export class RoadSegment {
    private static nextId = 1;
    readonly id = RoadSegment.nextId++;

    private startPoint: IPoint2D;
    private endPoint: IPoint2D;
    private arcMidPoint?: IPoint2D;

    private dualRoadType: IDualRoadType = {
        forward: { roadColor: 'old', lanes: 1, rightKerb: 'none', rightSidewalk: 'small', laneWidth: 'normal', leftKerb: 'none', leftSidewalk: 'none' },
        backward: { roadColor: 'old', lanes: 1, rightKerb: 'none', rightSidewalk: 'small', laneWidth: 'normal', leftKerb: 'none', leftSidewalk: 'none' },
        gapSize: 0
    };

    private junctionCuts?: { forwardCuts?: IRoadCuts; backwardCuts?: IRoadCuts };
    forwardPrimitive!: RoadPrimitive;
    backwardPrimitive?: RoadPrimitive;
    startJoinArcPrimitive?: RoadPrimitive;
    endJoinArcPrimitive?: RoadPrimitive;

    constructor(
        private readonly sceneRoot: THREE.Object3D,
        start: IPoint2D,
        end: IPoint2D,
        dualRoadType?: IDualRoadType,
    ) {
        this.startPoint = RoadSegment.toPoint(start);
        this.endPoint = RoadSegment.toPoint(end);

        if (dualRoadType) {
            this.dualRoadType = {
                forward: { ...dualRoadType.forward },
                backward: dualRoadType.backward ? { ...dualRoadType.backward } : undefined,
                gapSize: Number.isFinite(dualRoadType.gapSize) ? dualRoadType.gapSize : 0
            };
        }
        this.rebuild();
    }

    get start(): SegmentEndPoint {
        return { side: 'start', segment: this };
    }
    get end(): SegmentEndPoint {
        return { side: 'end', segment: this };
    }

    get angle(): number {
        const dx = this.endPoint.x - this.startPoint.x;
        const dz = this.endPoint.z - this.startPoint.z;
        return Math.atan2(-dz, dx);
    }

    get length(): number {
        const arc = this.#computeArcGeometry();
        if (!arc) {
            return this.#chordLength();
        }
        return Math.abs(arc.turnAngle) * arc.radius;
    }

    get startX(): number {
        return this.startPoint.x;
    }

    get startZ(): number {
        return this.startPoint.z;
    }

    get endX(): number {
        return this.endPoint.x;
    }

    get endZ(): number {
        return this.endPoint.z;
    }

    get arcMidX(): number | undefined { return this.arcMidPoint?.x; }
    get arcMidZ(): number | undefined { return this.arcMidPoint?.z; }

    getIRoad(): IDualRoadType {
        return this.dualRoadType;
    }

    setIRoad(nextRoad: IDualRoadType): void {
        this.dualRoadType = {
            forward: { ...nextRoad.forward },
            backward: nextRoad.backward ? { ...nextRoad.backward } : undefined,
            gapSize: Number.isFinite(nextRoad.gapSize) ? nextRoad.gapSize : 0,
        };
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
        this.startJoinArcPrimitive?.dispose();
        this.endJoinArcPrimitive?.dispose();
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
            parent: this.sceneRoot,
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
        if (this.forwardPrimitive) this.forwardPrimitive.dispose();
        if (this.backwardPrimitive) this.backwardPrimitive.dispose();

        this.forwardPrimitive = undefined as any;
        this.backwardPrimitive = undefined as any;

        const forwardCuts = this.junctionCuts?.forwardCuts;
        const backwardCuts = this.junctionCuts?.backwardCuts;

        const { forwardOffsetM, backwardOffsetM } = this.#getCarriagewayCenterOffsets();
        const start = { x: this.startPoint.x, z: this.startPoint.z };
        const end = { x: this.endPoint.x, z: this.endPoint.z };

        if (this.arcMidPoint) {
            const mid = { x: this.arcMidPoint.x, z: this.arcMidPoint.z };
            this.forwardPrimitive = new CurvedRoadPrimitive({
                parent: this.sceneRoot,
                transient: false,
                start,
                mid,
                end,
                roadType: this.dualRoadType.forward,
                lateralOffsetM: forwardOffsetM,
                cuts: forwardCuts,
            });

            if (this.dualRoadType.backward) {
                this.backwardPrimitive = new CurvedRoadPrimitive({
                    parent: this.sceneRoot,
                    transient: false,
                    start: end,
                    mid,
                    end: start,
                    roadType: this.dualRoadType.backward,
                    // Backward primitive runs in the opposite direction, so
                    // its local right-side offset sign must be inverted.
                    lateralOffsetM: -backwardOffsetM,
                    cuts: backwardCuts,
                });
            }
            return;
        }

        const normal = this.#getLateralNormal();
        const forwardStart = this.#offsetPoint(start, normal, forwardOffsetM);
        const forwardEnd = this.#offsetPoint(end, normal, forwardOffsetM);
        const backwardStart = this.#offsetPoint(start, normal, backwardOffsetM);
        const backwardEnd = this.#offsetPoint(end, normal, backwardOffsetM);

        this.forwardPrimitive = new StraightRoadPrimitive({
            parent: this.sceneRoot,
            transient: false,
            start: forwardStart,
            end: forwardEnd,
            roadType: this.dualRoadType.forward,
            cuts: forwardCuts,
        });

        if (this.dualRoadType.backward) {
            this.backwardPrimitive = new StraightRoadPrimitive({
                parent: this.sceneRoot,
                transient: false,
                start: backwardEnd,
                end: backwardStart,
                roadType: this.dualRoadType.backward,
                cuts: backwardCuts,
            });
        }
    }

    #getCarriagewayCenterOffsets(): { forwardOffsetM: number; backwardOffsetM: number } {
        if (!this.dualRoadType.backward) {
            return { forwardOffsetM: 0, backwardOffsetM: 0 };
        }

        const forwardCarriagewayWidthM = getBands(this.dualRoadType.forward).totalWidthM;
        const backwardCarriagewayWidthM = getBands(this.dualRoadType.backward).totalWidthM;
        const halfGapM = (this.dualRoadType.gapSize ?? 0) / 2;

        return {
            // Positive is right side relative to start -> end.
            forwardOffsetM: halfGapM + forwardCarriagewayWidthM / 2,
            backwardOffsetM: -halfGapM - backwardCarriagewayWidthM / 2,
        };
    }

    #getLateralNormal(): IPoint2D {
        const dx = this.endPoint.x - this.startPoint.x;
        const dz = this.endPoint.z - this.startPoint.z;
        const length = Math.hypot(dx, dz);
        if (length <= 1e-6) return { x: 0, z: 0 };

        const angle = Math.atan2(-dz, dx);
        return { x: Math.sin(angle), z: Math.cos(angle) };
    }

    #offsetPoint(point: IPoint2D, normal: IPoint2D, offsetM: number): IPoint2D {
        if (offsetM === 0) return { x: point.x, z: point.z };
        return {
            x: point.x + normal.x * offsetM,
            z: point.z + normal.z * offsetM,
            y: point.y,
        };
    }

    /** Curve the road through a world-space control point. Keeps start and end fixed. */
    setArc(mid: IPoint2D, end?: IPoint2D, forceArc = false): void {
        if (end) {
            this.endPoint = RoadSegment.toPoint(end);
        }

        const targetEndX = this.endPoint.x;
        const targetEndZ = this.endPoint.z;

        // If arc control returns near the straight chord, switch back to true straight mode.
        // Transient join arcs may force curved mode to preserve small-angle round corners.
        const chordDx = targetEndX - this.startPoint.x;
        const chordDz = targetEndZ - this.startPoint.z;
        const chordLength = Math.hypot(chordDx, chordDz);
        if (!forceArc && chordLength > 1e-6) {
            const ux = chordDx / chordLength;
            const uz = chordDz / chordLength;
            const nx = -uz;
            const nz = ux;
            const mx = mid.x - this.startPoint.x;
            const mz = mid.z - this.startPoint.z;
            const perpendicularDistance = Math.abs(mx * nx + mz * nz);
            const straightThreshold = Math.max(0.2, chordLength * 0.02);

            if (perpendicularDistance <= straightThreshold) {
                this.#setStraightFromEnd({ x: targetEndX, z: targetEndZ });
                this.rebuild();
                return;
            }
        }

        this.arcMidPoint = RoadSegment.toPoint(mid);
        this.rebuild();
    }

    #setStraightFromEnd(end: IPoint2D): void {
        this.endPoint = RoadSegment.toPoint(end);
        this.arcMidPoint = undefined;
    }

    moveTo(start: IPoint2D, angle: number): void {
        const currentLength = this.#chordLength();
        this.startPoint = RoadSegment.toPoint(start);
        this.endPoint = {
            x: start.x + Math.cos(angle) * currentLength,
            z: start.z - Math.sin(angle) * currentLength,
        };
        this.arcMidPoint = undefined;
        this.rebuild();
    }

    /** Change length and rebuild geometry. Clears any arc. */
    resize(newLength: number): void {
        const angle = this.angle;
        this.endPoint = {
            x: this.startPoint.x + Math.cos(angle) * newLength,
            z: this.startPoint.z - Math.sin(angle) * newLength,
        };
        this.arcMidPoint = undefined;
        this.rebuild();
    }

    rebuild(): void {
        this.compilePrimitives();
    }

    dispose(): void {
        this.forwardPrimitive?.dispose();
        this.backwardPrimitive?.dispose();
        this.startJoinArcPrimitive?.dispose();
        this.endJoinArcPrimitive?.dispose();
    }

    #chordLength(): number {
        return Math.hypot(this.endPoint.x - this.startPoint.x, this.endPoint.z - this.startPoint.z);
    }

    #computeArcGeometry(): { radius: number; turnAngle: number } | null {
        if (!this.arcMidPoint) return null;

        const p1x = this.startPoint.x;
        const p1z = this.startPoint.z;
        const p2x = this.arcMidPoint.x;
        const p2z = this.arcMidPoint.z;
        const p3x = this.endPoint.x;
        const p3z = this.endPoint.z;

        const determinant = 2 * (p1x * (p2z - p3z) + p2x * (p3z - p1z) + p3x * (p1z - p2z));
        if (Math.abs(determinant) < 0.01) {
            if (DEBUG_ROAD_ARC) {
                console.log('[RoadArc] fallback-straight', {
                    segmentId: this.id,
                    determinant,
                });
            }
            return null;
        }

        const w1 = p1x * p1x + p1z * p1z;
        const w2 = p2x * p2x + p2z * p2z;
        const w3 = p3x * p3x + p3z * p3z;
        const cx = (w1 * (p2z - p3z) + w2 * (p3z - p1z) + w3 * (p1z - p2z)) / determinant;
        const cz = (w1 * (p3x - p2x) + w2 * (p1x - p3x) + w3 * (p2x - p1x)) / determinant;
        const radius = Math.hypot(p1x - cx, p1z - cz);

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

        const shortDelta = normalizeSigned(a3 - a1);
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
            turnAngle = shortDelta;
        }

        return { radius, turnAngle };
    }

    private static toPoint(point: IPoint2D): IPoint2D {
        return { x: point.x, z: point.z, y: point.y };
    }

}
