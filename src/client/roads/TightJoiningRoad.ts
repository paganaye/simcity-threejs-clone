import * as THREE from 'three';
import type { IRoadType } from './IRoad';
import { StraightRoadPrimitive } from './StraightRoadPrimitive';
import type { PrimitiveEntry, PrimitiveExit } from './RoadPrimitive';
import type { TightJoinGeometry } from './JoiningRoads';

export class TightJoiningRoad extends StraightRoadPrimitive {

    constructor(params: {
        parent: THREE.Object3D;
        roadType: IRoadType;
        previousRoadExit: PrimitiveExit;
        nextRoadEntry: PrimitiveEntry;
        geometry: TightJoinGeometry;
    }) {
        super({
            parent: params.parent,
            segment: undefined,
            transient: true,
            start: params.geometry.start,
            end: params.geometry.end,
            roadType: params.roadType,
            cuts: {
                entryCut: params.geometry.secondEntryCut,
                exitCut: params.geometry.secondExitCut,
            },
        });
    }

}
