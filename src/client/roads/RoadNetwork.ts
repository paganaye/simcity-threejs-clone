import * as THREE from 'three';
import type { PrimitiveEndPoint, PrimitiveSide, RoadPrimitive } from './RoadPrimitive';
import { joinPrimitives } from './joinPrimitives';
import { RoadSegment, SegmentEndPoint, SegmentSide } from './RoadSegment';
import { GameScene3D } from '../GameScene3D';

const DEFAULT_JOIN_RADIUS = 8;

export class RoadNetwork {
    readonly segments: RoadSegment[] = [];

    constructor(readonly scene: GameScene3D) { }

    *endPoints(): Iterable<PrimitiveEndPoint> {
        for (let segment of this.segments) {
            yield { primitive: segment.forwardPrimitive, side: 'start' };
            yield { primitive: segment.forwardPrimitive, side: 'end' };
            if (segment.backwardPrimitive) {
                yield { primitive: segment.backwardPrimitive, side: 'start' };
                yield { primitive: segment.backwardPrimitive, side: 'end' };
            }
        }
    }

    refreshTransientJoinArcs(road: RoadSegment | undefined, _side?: SegmentSide | undefined): void {
        if (!road) return;
        const sceneRoot = this.scene.scene;

        for (const other of this.segments) {
            if (other === road) continue;

            const touchingSegments = this.#findTouchingSegments(road, other);
            if (!touchingSegments) continue;
            if (touchingSegments.selectedSide.side == 'start' && touchingSegments.otherSide.side == 'start') {
                this.tryJoiningPrimitives(
                    sceneRoot,
                    road.forwardPrimitive,
                    'start',
                    other.backwardPrimitive,
                    'end');
                this.tryJoiningPrimitives(
                    sceneRoot,
                    road.backwardPrimitive,
                    'start',
                    other.backwardPrimitive,
                    'end');


            }
            //debugger;
            // if (road.forwardPrimitive && other.backwardPrimitive) {
            //     this.#tryRenderJoin(
            //         sceneRoot,


            //         other.backwardPrimitive,
            //         this.#primitiveSideFromSegmentSide(touchingSides.otherSide, 'backward'),
            //     );
            // }

            // if (road.backwardPrimitive && other.forwardPrimitive) {
            //     this.#tryRenderJoin(
            //         sceneRoot,
            //         road.backwardPrimitive,
            //         this.#primitiveSideFromSegmentSide(touchingSides.selectedSide, 'backward'),
            //         other.forwardPrimitive,
            //         this.#primitiveSideFromSegmentSide(touchingSides.otherSide, 'forward'),
            //     );
            // }
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
        return true;
    }

    clear(): void {
        for (const segment of [...this.segments]) {
            segment.dispose();
        }
        this.segments.length = 0;
    }

    tryJoiningPrimitives(
        sceneRoot: THREE.Object3D,
        first: RoadPrimitive | undefined | null,
        firstSide: PrimitiveSide,
        second: RoadPrimitive | undefined | null,
        secondSide: PrimitiveSide,
    ): boolean {
        if (!first || !second) return false;
        const joined = joinPrimitives(first, firstSide, second, secondSide, { radius: DEFAULT_JOIN_RADIUS });
        if (!joined) return false;
        joined.createMesh(sceneRoot);
        return true;
    }


    #findTouchingSegments(
        selected: RoadSegment,
        other: RoadSegment,
    ): {
        selectedSide: SegmentEndPoint;
        otherSide: SegmentEndPoint
        distance: number;
    } | null {
        const endpointPairs = [
            [selected.start, other.start],
            [selected.start, other.end],
            [selected.end, other.start],
            [selected.end, other.end],
        ];
        let best: { selectedSide: SegmentEndPoint; otherSide: SegmentEndPoint; distance: number } | null = null;
        for (const pair of endpointPairs) {
            let distance = Math.hypot(
                pair[0].segment.endX - pair[1].segment.endX,
                pair[0].segment.endZ - pair[1].segment.endZ,
            );
            if (!best || distance < best.distance) {
                best = {
                    selectedSide: pair[0],
                    otherSide: pair[1],
                    distance,
                };
            }
        }
        if (!best) return null;
        return best;
    }
}
