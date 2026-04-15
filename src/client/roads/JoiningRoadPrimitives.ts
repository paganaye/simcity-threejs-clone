import * as THREE from 'three';
import type { IJoiningPrimitives, PrimitiveEntry, PrimitiveExit, RoadPrimitive } from './RoadPrimitive';
import type { IRoadType } from './IRoad';
import { JoiningPrimitiveOptions, JoiningRoads, type ArcJoinGeometry } from './JoiningRoads';

export interface JoiningRoadPrimitiveParams {
    parent: THREE.Object3D;
    roadType: IRoadType;
    previousRoadExit: PrimitiveExit;
    nextRoadEntry: PrimitiveEntry;
    joiningPrimitiveOptions: JoiningPrimitiveOptions;
    geometry: ArcJoinGeometry;
};

export class JoiningRoadPrimitives implements IJoiningPrimitives {
    params: JoiningRoadPrimitiveParams;
    road!: RoadPrimitive | null;

    constructor(params: JoiningRoadPrimitiveParams) {
        params.nextRoadEntry.disposeJoin();
        params.previousRoadExit.disposeJoin();
        this.params = params;
        this.params.nextRoadEntry.joiningPrimitives = this;
        this.params.previousRoadExit.joiningPrimitives = this;
        this.rebuild();
    }

    dispose(): void {
        this.road?.dispose();
    }

    onAdjacentRoadMoved(): void {
        this.rebuild();
    }

    private rebuild() {
        this.road?.dispose();
        this.road = JoiningRoads.createJoiningRoadsPrimitive(
            this.params.parent,
            this.params.previousRoadExit,
            this.params.nextRoadEntry,
            this.params.roadType,
            this.params.joiningPrimitiveOptions);
    }

    onDispose(): void {
        if (this.params.nextRoadEntry.joiningPrimitives === this) {
            this.params.nextRoadEntry.joiningPrimitives = null;
        }
        if (this.params.previousRoadExit.joiningPrimitives === this) {
            this.params.previousRoadExit.joiningPrimitives = null;
        }
    }
}
