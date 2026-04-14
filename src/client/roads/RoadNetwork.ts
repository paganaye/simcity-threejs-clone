import * as THREE from 'three';
import type { PrimitiveEndPoint } from './RoadPrimitive';
import { RoadSegment, SegmentEndPoint, SegmentSide } from './RoadSegment';
import { GameScene3D } from '../GameScene3D';
import { JoiningRoadPrimitive } from './JoiningRoadPrimitive';

const DEFAULT_JOIN_RADIUS = 8;
const JOIN_EPSILON = 0.45;

export class RoadNetwork {
    readonly segments: RoadSegment[] = [];

    constructor(readonly scene: GameScene3D) { }

    *endPoints(): Iterable<PrimitiveEndPoint> {
        for (let segment of this.segments) {
            yield { primitive: segment.forwardPrimitive, side: 'entry' };
            yield { primitive: segment.forwardPrimitive, side: 'exit' };
            if (segment.backwardPrimitive) {
                yield { primitive: segment.backwardPrimitive, side: 'entry' };
                yield { primitive: segment.backwardPrimitive, side: 'exit' };
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

            if (touchingSegments.selectedSide.side == 'start' && touchingSegments.otherSide.side == 'end') {
                // this.tryJoiningPrimitives(
                //     sceneRoot,
                //     { primitive: road.forwardPrimitive!, side: 'start' },
                //     { primitive: other.backwardPrimitive!, side: 'end' }
                // );
                this.tryJoiningPrimitives(
                    sceneRoot,
                    { primitive: road.backwardPrimitive!, side: 'entry' },
                    { primitive: other.forwardPrimitive!, side: 'exit' }
                );
            } else {

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

     tryJoiningPrimitives(
        sceneRoot: THREE.Object3D,
        first: PrimitiveEndPoint | undefined | null,
        second: PrimitiveEndPoint | undefined | null,
    ): boolean {
        if (!first || !second) return false;
        const joined = JoiningRoadPrimitive.joinPrimitives(sceneRoot, first, second, second.primitive.roadType, { radius: DEFAULT_JOIN_RADIUS });
        if (!joined) return false;
        //joined.recreateMesh();
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
        const getPoint = (endPoint: SegmentEndPoint): { x: number; z: number } =>
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
