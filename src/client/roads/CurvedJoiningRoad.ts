import * as THREE from 'three';
import { CurvedRoadPrimitive } from './CurvedRoadPrimitive';
import type { PrimitiveEntry, PrimitiveExit } from './RoadPrimitive';
import type { IRoadType } from './IRoad';
import { JoiningPrimitiveOptions, type ArcJoinGeometry } from './JoiningRoads';

export class CurvedJoiningRoad extends CurvedRoadPrimitive {
    joiningPrimitiveOptions: JoiningPrimitiveOptions;

    constructor(params: {
        parent: THREE.Object3D;
        roadType: IRoadType;
        previousRoadExit: PrimitiveExit;
        nextRoadEntry: PrimitiveEntry;
        joiningPrimitiveOptions: JoiningPrimitiveOptions;
        geometry: ArcJoinGeometry;
    }) {
        super({
            parent: params.parent,
            segment: null as any,
            transient: true,
            start: params.geometry.start,
            mid: params.geometry.mid,
            end: params.geometry.end,
            roadType: params.roadType,
        });
        this.joiningPrimitiveOptions = params.joiningPrimitiveOptions;
    }


}
