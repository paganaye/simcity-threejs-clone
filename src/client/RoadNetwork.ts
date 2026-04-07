import * as THREE from 'three';
import { RoadSegment } from './RoadSegment';
import { RoadType } from './RoadBuilder';

export class RoadNetwork {
    readonly segments: RoadSegment[] = [];

    addSegment(
        scene: THREE.Object3D,
        startX: number,
        startZ: number,
        angle: number,
        length: number,
        roadType: RoadType = 'l1',
    ): RoadSegment {
        const segment = new RoadSegment(scene, startX, startZ, angle, length, roadType);
        this.segments.push(segment);
        return segment;
    }

    removeSegment(segment: RoadSegment): void {
        const idx = this.segments.indexOf(segment);
        if (idx >= 0) {
            this.segments.splice(idx, 1);
            segment.dispose();
        }
    }

    /** Register an already-constructed segment (created externally) into this network. */
    registerSegment(segment: RoadSegment): void {
        this.segments.push(segment);
    }
}
