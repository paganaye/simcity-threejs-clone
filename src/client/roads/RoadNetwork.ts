import type { PrimitiveEndPoint, RoadPrimitive } from './RoadPrimitive';
import { RoadSegment, SegmentEndPoint, SegmentSide } from './RoadSegment';
import { GameScene3D } from '../GameScene3D';
import { JoiningRoadPrimitive } from './JoiningRoadPrimitive';
import { IPoint2D } from '../../sim/Geometry';

const DEFAULT_JOIN_RADIUS = 8;
const JOIN_EPSILON = 0.45;

export class RoadNetwork {
    readonly segments: RoadSegment[] = [];

    constructor(readonly scene: GameScene3D) { }

    *endPoints(): Iterable<PrimitiveEndPoint> {
        for (let segment of this.segments) {
            yield segment.forwardPrimitive.entry;
            yield segment.forwardPrimitive.exit;
            if (segment.backwardPrimitive) {
                yield segment.backwardPrimitive.entry;
                yield segment.backwardPrimitive.exit;
            }
        }
    }

    checkJoiningArcs(road: RoadSegment | undefined, _side?: SegmentSide | undefined): void {
        if (!road) return;
        const sceneRoot = this.scene.scene;

        for (const other of this.segments) {
            if (other === road) continue;

            const touchingSegments = this.#findTouchingSegments(road, other);
            if (!touchingSegments) continue;

            let fwExitRoad: RoadPrimitive | undefined;
            let fwEntryRoad: RoadPrimitive | undefined;

            let bwExitRoad: RoadPrimitive | undefined;
            let bwEntryRoad: RoadPrimitive | undefined;

            const selectedAtStart = touchingSegments.selectedSide.side === 'start';
            const otherAtStart = touchingSegments.otherSide.side === 'start';

            fwExitRoad = otherAtStart ? other.backwardPrimitive : other.forwardPrimitive;
            fwEntryRoad = selectedAtStart ? road.forwardPrimitive : road.backwardPrimitive;
            bwExitRoad = selectedAtStart ? road.backwardPrimitive : road.forwardPrimitive;
            bwEntryRoad = otherAtStart ? other.forwardPrimitive : other.backwardPrimitive;

            
            if (fwExitRoad && fwEntryRoad) {
                JoiningRoadPrimitive.joinPrimitives(
                    sceneRoot,
                    fwExitRoad.exit,
                    fwEntryRoad.entry,
                    road.forwardPrimitive.roadType,
                    { radius: DEFAULT_JOIN_RADIUS },
                );
            }

            if (bwExitRoad && bwEntryRoad) {
                JoiningRoadPrimitive.joinPrimitives(
                    sceneRoot,
                    bwExitRoad.exit,
                    bwEntryRoad.entry,
                    road.backwardPrimitive!.roadType,
                    { radius: DEFAULT_JOIN_RADIUS },
                );

            }

        }
    }

    addSegment(segment: RoadSegment): RoadSegment {
        if (!this.segments.includes(segment)) {
            this.segments.push(segment);
        }
        return segment;
    }

    removeSegment(segment: RoadSegment): boolean {
        const index = this.segments.indexOf(segment);
        if (index < 0) return false;
        this.segments.splice(index, 1);
        segment.dispose();
        return true;
    }

    clear(): void {
        for (const segment of [...this.segments]) {
            segment.dispose();
        }
        this.segments.length = 0;
    }



    #findTouchingSegments(
        selected: RoadSegment,
        other: RoadSegment,
    ): {
        selectedSide: SegmentEndPoint;
        otherSide: SegmentEndPoint
        distance: number;
    } | null {
        const getPoint = (endPoint: SegmentEndPoint): IPoint2D =>
            endPoint.side === 'start'
                ? { x: endPoint.segment.startX, z: endPoint.segment.startZ }
                : { x: endPoint.segment.endX, z: endPoint.segment.endZ };

        const endpointPairs = [
            [selected.start, other.start],
            [selected.start, other.end],
            [selected.end, other.start],
            [selected.end, other.end],
        ];
        let best: { selectedSide: SegmentEndPoint; otherSide: SegmentEndPoint; distance: number } | null = null;
        for (const pair of endpointPairs) {
            const a = getPoint(pair[0]);
            const b = getPoint(pair[1]);
            let distance = Math.hypot(
                a.x - b.x,
                a.z - b.z,
            );
            if (!best || distance < best.distance) {
                best = {
                    selectedSide: pair[0],
                    otherSide: pair[1],
                    distance,
                };
            }
        }
        if (!best || best.distance > JOIN_EPSILON) return null;
        return best;
    }
}
