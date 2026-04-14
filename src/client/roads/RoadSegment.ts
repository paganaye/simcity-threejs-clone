import type { IRoadCuts } from './RoadCuts';
import type { IDualRoadType, IRoadType } from './IRoad';
import { RoadPrimitive } from './RoadPrimitive';
import { StraightRoadPrimitive } from './StraightRoadPrimitive';
import { CurvedRoadPrimitive } from './CurvedRoadPrimitive';
import { getBands } from './RoadLayout';
import { computeArcFromThreePoints, distance2D, getRightNormal, IPoint2D, offsetPoint as offsetPoint2D } from '../../sim/Geometry';
import { GameScene3D } from '../GameScene3D';

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
        readonly gameScene3D: GameScene3D,
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
        gameScene3D.roadNetwork.addSegment(this);
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
            parent: this.gameScene3D.scene,
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
                parent: this.gameScene3D.scene,
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
                    parent: this.gameScene3D.scene,
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
        const forwardStart = offsetPoint2D(start, normal, forwardOffsetM);
        const forwardEnd = offsetPoint2D(end, normal, forwardOffsetM);
        const backwardStart = offsetPoint2D(start, normal, backwardOffsetM);
        const backwardEnd = offsetPoint2D(end, normal, backwardOffsetM);

        this.forwardPrimitive = new StraightRoadPrimitive({
            parent: this.gameScene3D.scene,
            transient: false,
            start: forwardStart,
            end: forwardEnd,
            roadType: this.dualRoadType.forward,
            cuts: forwardCuts,
        });

        if (this.dualRoadType.backward) {
            this.backwardPrimitive = new StraightRoadPrimitive({
                parent: this.gameScene3D.scene,
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
        return getRightNormal(this.startPoint, this.endPoint);
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
        const chordLength = distance2D(this.startPoint, this.endPoint);
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
        return distance2D(this.startPoint, this.endPoint);
    }

    #computeArcGeometry(): { radius: number; turnAngle: number } | null {
        if (!this.arcMidPoint) return null;
        const arc = computeArcFromThreePoints(this.startPoint, this.arcMidPoint, this.endPoint);
        if (!arc) {
            if (DEBUG_ROAD_ARC) {
                console.log('[RoadArc] fallback-straight', {
                    segmentId: this.id,
                });
            }
            return null;
        }

        return { radius: arc.radius, turnAngle: arc.sweepAngle };
    }

    private static toPoint(point: IPoint2D): IPoint2D {
        return { x: point.x, z: point.z, y: point.y };
    }

}
