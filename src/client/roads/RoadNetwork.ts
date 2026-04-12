import type { PrimitiveSide, RoadPrimitive } from './RoadPrimitive';
import { joinPrimitives } from './joinPrimitives';
import { RoadSegment } from './RoadSegment';

const JOIN_EPSILON = 0.45;
const DEFAULT_JOIN_RADIUS = 6;

export class RoadNetwork {
    readonly segments: RoadSegment[] = [];
    private readonly transientJoinPrimitives: RoadPrimitive[] = [];

    refreshTransientJoinArcs(road: RoadSegment | undefined): void {
        this.clearTransientJoinArcs();
        for (const segment of this.segments) {
            segment.clearTransientJoinArcPrimitives();
        }
        if (!road) return;

        const sceneRoot = road.group.parent;
        if (!sceneRoot) return;

        const selectedPrimitives = this.#getSegmentPrimitives(road);
        if (!selectedPrimitives.length) return;

        const sides: PrimitiveSide[] = ['start', 'end'];
        for (const side of sides) {
            const candidate = this.#findBestJoinCandidate(road, selectedPrimitives, side);
            if (!candidate) continue;

            const joined = joinPrimitives(
                candidate.first,
                candidate.firstSide,
                candidate.second,
                candidate.secondSide,
                { radius: DEFAULT_JOIN_RADIUS },
            );
            if (!joined) continue;

            joined.createMesh(sceneRoot);
            this.transientJoinPrimitives.push(joined);
        }
    }

    registerSegment(segment: RoadSegment): RoadSegment {
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
        this.clearTransientJoinArcs();
        return true;
    }

    clear(): void {
        this.clearTransientJoinArcs();
        for (const segment of [...this.segments]) {
            segment.dispose();
        }
        this.segments.length = 0;
    }

    clearTransientJoinArcs(): void {
        for (const primitive of this.transientJoinPrimitives) {
            primitive.clearMesh();
        }
        this.transientJoinPrimitives.length = 0;
    }

    #getSegmentPrimitives(segment: RoadSegment): RoadPrimitive[] {
        const result: RoadPrimitive[] = [];
        if (segment.forwardPrimitive) result.push(segment.forwardPrimitive);
        if (segment.backwardPrimitive) result.push(segment.backwardPrimitive);
        return result;
    }

    #findBestJoinCandidate(
        selectedSegment: RoadSegment,
        selectedPrimitives: RoadPrimitive[],
        selectedSide: PrimitiveSide,
    ):
        | {
            first: RoadPrimitive;
            firstSide: PrimitiveSide;
            second: RoadPrimitive;
            secondSide: PrimitiveSide;
            distance: number;
        }
        | null {
        let best:
            | {
                first: RoadPrimitive;
                firstSide: PrimitiveSide;
                second: RoadPrimitive;
                secondSide: PrimitiveSide;
                distance: number;
            }
            | null = null;

        const sides: PrimitiveSide[] = ['start', 'end'];

        for (const otherSegment of this.segments) {
            if (otherSegment === selectedSegment) continue;
            const otherPrimitives = this.#getSegmentPrimitives(otherSegment);
            if (!otherPrimitives.length) continue;

            for (const first of selectedPrimitives) {
                const firstPoint = first.getPoint(selectedSide);
                for (const second of otherPrimitives) {
                    for (const secondSide of sides) {
                        const secondPoint = second.getPoint(secondSide);
                        const distance = Math.hypot(firstPoint.x - secondPoint.x, firstPoint.z - secondPoint.z);
                        if (distance > JOIN_EPSILON) continue;
                        if (!best || distance < best.distance) {
                            best = {
                                first,
                                firstSide: selectedSide,
                                second,
                                secondSide,
                                distance,
                            };
                        }
                    }
                }
            }
        }

        return best;
    }
}
