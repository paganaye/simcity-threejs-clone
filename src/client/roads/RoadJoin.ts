import * as THREE from 'three';
import type { PrimitiveEntry, PrimitiveExit, RoadPrimitive } from './RoadPrimitive';
import type { IRoadType } from './IRoad';
import { CurvedJoiningRoad } from './CurvedJoiningRoad';
import { TightJoiningRoad, } from './TightJoiningRoad';

const DEBUG_JOINING_ROAD = true;

export type JoiningPrimitiveOptions = {
    radius?: number;
};

export interface JoiningRoadsParams {
    parent: THREE.Object3D;
    previousRoadExit: PrimitiveExit;
    nextRoadEntry: PrimitiveEntry;
    roadType: IRoadType;
    radius: number;
};

export class RoadJoin {
    params: JoiningRoadsParams;
    road!: RoadPrimitive | null;

    private static debug(message: string, data?: unknown): void {
        if (!DEBUG_JOINING_ROAD) return;
        if (data === undefined) {
            console.log(`[JoiningRoads] ${message}`);
            return;
        }
        console.log(`[JoiningRoads] ${message}`, data);
    }

    static resolveRequestedRadius(radius: number | undefined): number {
        return typeof radius === 'number' && Number.isFinite(radius) ? Math.max(0, Math.abs(radius)) : 6;
    }

    static joinRoads(
        parent: THREE.Object3D,
        previousRoadExit: PrimitiveExit,
        nextRoadEntry: PrimitiveEntry,
        roadType: IRoadType,
        options: JoiningPrimitiveOptions = {},
    ): void {
        let newJoin = new RoadJoin({
            parent,
            roadType,
            previousRoadExit,
            nextRoadEntry,
            radius: RoadJoin.resolveRequestedRadius(options.radius),
        });
        newJoin.build();

    }

    private constructor(params: JoiningRoadsParams) {
        this.params = params;
        params.nextRoadEntry.disposeJoin();
        params.previousRoadExit.disposeJoin();
        this.params.nextRoadEntry.roadJoin = this;
        this.params.previousRoadExit.roadJoin = this;
    }

    dispose(): void {
        this.road?.dispose();
    }

    onAdjacentRoadMoved(): void {
        this.build();
    }

    private build() {
        this.road?.dispose();

        let result: RoadPrimitive | null = CurvedJoiningRoad.create(this.params);
        if (!result) {
            result = TightJoiningRoad.create(this.params);
        }
        if (result) {
            this.road = result;
        } else {
            RoadJoin.debug('joinRoads: no curved or tight geometry possible');
        }

    }

    onDispose(): void {
        if (this.params.nextRoadEntry.roadJoin === this) {
            this.params.nextRoadEntry.roadJoin = null;
        }
        if (this.params.previousRoadExit.roadJoin === this) {
            this.params.previousRoadExit.roadJoin = null;
        }
    }

}
