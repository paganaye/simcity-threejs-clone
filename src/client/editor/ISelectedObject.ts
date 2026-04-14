import * as THREE from 'three';
import type { Character } from '../characters/Character';
import type { RoadSegment } from '../roads/RoadSegment';
import type { Building } from './Building';
import { ModelName, IFastMesh } from '../AssetManager';

export type SelectedKind = 'road' | 'building' | 'character' | 'handle'; // | 'object';


export type ISelectedObject = (ISelectedRoad | ISelectedBuilding | ISelectedCharacter | ISelectedHandle) & {
    kind?: SelectedKind;
    roadSegment?: RoadSegment;
    instanceId?: number | undefined;
};


export type ISelectedRoad = {
    kind: 'road';
    object3D: THREE.Object3D;
}
export type ISelectedBuilding = {
    kind: 'building';
    object3D: THREE.InstancedMesh | THREE.Object3D;
    instanceId: number;
    modelName?: ModelName;
    building?: Building;
    mesh?: IFastMesh;
}
export type ISelectedCharacter = {
    kind: 'character';
    object3D: THREE.Object3D;
    character?: Character;
}

export type ISelectedHandle = {
    kind: 'handle';
    object3D: THREE.Object3D;
    handleType: string;
}