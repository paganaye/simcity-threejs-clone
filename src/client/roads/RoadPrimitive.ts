import * as THREE from 'three';
import type { IRoadCuts } from '../textures/RoadBuilder';
import type { IRoadType } from './IRoad';
import { IPointXZ } from './RoadPrimitiveCompiler';


export abstract class RoadPrimitive {
    transient: boolean;
    direction: 'forward' | 'backward';
    start: IPointXZ;
    end: IPointXZ;
    roadType: IRoadType;
    cuts?: IRoadCuts;

    protected constructor(params: {
        transient: boolean;
        direction: 'forward' | 'backward';
        start: IPointXZ;
        end: IPointXZ;
        roadType: IRoadType;
        cuts?: IRoadCuts;
    }) {
        this.transient = params.transient;
        this.direction = params.direction;
        this.start = params.start;
        this.end = params.end;
        this.roadType = params.roadType;
        this.cuts = params.cuts;
    }

    abstract createGeometry(params?: {
        y?: number;
        textureProgressV?: number;
        lineLength?: number;
        segmentLength?: number;
    }): THREE.BufferGeometry | null;

    abstract createMesh(params: {
        material: THREE.Material;
        y?: number;
        textureProgressV?: number;
        lineLength?: number;
        segmentLength?: number;
        offsetM?: number;
    }): THREE.Mesh | null;
}
