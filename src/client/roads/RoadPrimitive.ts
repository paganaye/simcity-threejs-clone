import * as THREE from 'three';
import type { IRoadCuts } from './RoadCuts';
import type { IRoadType } from './IRoad';
import { IPoint2D } from '../../sim/IPoint';

export type PrimitiveSide = 'start' | 'end';

export type PrimitiveEndPoint = {
    side: PrimitiveSide;
    primitive: RoadPrimitive;
}

export abstract class RoadPrimitive {
    transient: boolean;
    startPos: IPoint2D;
    endPos: IPoint2D;
    roadType: IRoadType;
    cuts?: IRoadCuts;
    private mesh?: THREE.Mesh;

    protected constructor(params: {
        transient: boolean;
        start: IPoint2D;
        end: IPoint2D;
        roadType: IRoadType;
        cuts?: IRoadCuts;
    }) {
        this.transient = params.transient;
        this.startPos = params.start;
        this.endPos = params.end;
        this.roadType = params.roadType;
        this.cuts = params.cuts;
    }
    
    get start(): PrimitiveEndPoint {
        return { side: 'start', primitive: this };
    }
    
    get end(): PrimitiveEndPoint {
        return { side: 'end', primitive: this };
    }

    abstract createGeometry(params?: {
        y?: number;
        textureProgressV?: number;
        lineLength?: number;
        segmentLength?: number;
    }): THREE.BufferGeometry | null;

    clearMesh(): void {
        if (!this.mesh) return;
        this.mesh.geometry.dispose();
        this.mesh.parent?.remove(this.mesh);
        this.mesh = undefined;
    }

    protected replaceMesh(scene: THREE.Object3D, mesh: THREE.Mesh | null): void {
        this.clearMesh();
        if (!mesh) return;
        this.mesh = mesh;
        scene.add(mesh);
    }


    abstract createMesh(scene: THREE.Object3D): void;

    getPoint(side: PrimitiveSide) {
        return side === 'start' ? this.startPos : this.endPos;
    }


    movePoint(side: PrimitiveSide, point: IPoint2D): void {
        if (side === 'start') {
            this.startPos = point;
        } else {
            this.endPos = point;
        }
    }

}
