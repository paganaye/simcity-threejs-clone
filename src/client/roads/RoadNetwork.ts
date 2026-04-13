import * as THREE from 'three';
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

        for (const other of this.segments) {
            if (other === road) continue;

            const touchingSides = this.#findTouchingSides(road, other);
            if (!touchingSides) continue;

            if (road.forwardPrimitive && other.backwardPrimitive) {
                this.#tryRenderJoin(
                    sceneRoot,
                    road.forwardPrimitive,
                    this.#primitiveSideFromSegmentSide(touchingSides.selectedSide, 'forward'),
                    other.backwardPrimitive,
                    this.#primitiveSideFromSegmentSide(touchingSides.otherSide, 'backward'),
                );
            }

            if (road.backwardPrimitive && other.forwardPrimitive) {
                this.#tryRenderJoin(
                    sceneRoot,
                    road.backwardPrimitive,
                    this.#primitiveSideFromSegmentSide(touchingSides.selectedSide, 'backward'),
                    other.forwardPrimitive,
                    this.#primitiveSideFromSegmentSide(touchingSides.otherSide, 'forward'),
                );
            }
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

    #tryRenderJoin(
        sceneRoot: THREE.Object3D,
        first: RoadPrimitive,
        firstSide: PrimitiveSide,
        second: RoadPrimitive,
        secondSide: PrimitiveSide,
    ): void {
        const joined = joinPrimitives(first, firstSide, second, secondSide, { radius: DEFAULT_JOIN_RADIUS });
        if (!joined) return;
        joined.createMesh(sceneRoot);
        this.transientJoinPrimitives.push(joined);
    }

    #primitiveSideFromSegmentSide(
        segmentSide: PrimitiveSide,
        direction: 'forward' | 'backward',
    ): PrimitiveSide {
        if (direction === 'forward') {
            return segmentSide;
        }
        return segmentSide === 'start' ? 'end' : 'start';
    }

    #findTouchingSides(
        selected: RoadSegment,
        other: RoadSegment,
    ): { selectedSide: PrimitiveSide; otherSide: PrimitiveSide } | null {
        const endpointPairs: Array<{
            selectedSide: PrimitiveSide;
            otherSide: PrimitiveSide;
            distance: number;
        }> = [
            {
                selectedSide: 'start',
                otherSide: 'start',
                distance: Math.hypot(selected.startX - other.startX, selected.startZ - other.startZ),
            },
            {
                selectedSide: 'start',
                otherSide: 'end',
                distance: Math.hypot(selected.startX - other.endX, selected.startZ - other.endZ),
            },
            {
                selectedSide: 'end',
                otherSide: 'start',
                distance: Math.hypot(selected.endX - other.startX, selected.endZ - other.startZ),
            },
            {
                selectedSide: 'end',
                otherSide: 'end',
                distance: Math.hypot(selected.endX - other.endX, selected.endZ - other.endZ),
            },
        ];

        let best: { selectedSide: PrimitiveSide; otherSide: PrimitiveSide; distance: number } | null = null;
        for (const pair of endpointPairs) {
            if (pair.distance > JOIN_EPSILON) continue;
            if (!best || pair.distance < best.distance) {
                best = pair;
            }
        }

        if (!best) return null;
        return {
            selectedSide: best.selectedSide,
            otherSide: best.otherSide,
        };
    }
}
