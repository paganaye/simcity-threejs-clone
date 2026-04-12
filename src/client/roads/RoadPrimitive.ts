import * as THREE from 'three';
import type { IRoadCuts } from './RoadCuts';
import type { IRoadType } from './IRoad';
import { IPoint2D } from '../../sim/IPoint';
import { RoadTextureBuilder } from '../textures/RoadTextureBuilder';

export type PrimitiveSide = 'start' | 'end';

export type PrimitiveEndPoint = {
    side: PrimitiveSide;
    primitive: RoadPrimitive;
}

export abstract class RoadPrimitive {
    transient: boolean;
    start: IPoint2D;
    end: IPoint2D;
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

    protected resolveMaterial(material?: THREE.Material): THREE.Material {
        return material ?? RoadTextureBuilder.getRoadMaterial(this.roadType);
    }

    abstract createMesh(params: {
        scene: THREE.Object3D;
        material?: THREE.Material;
        y?: number;
        textureProgressV?: number;
        lineLength?: number;
        segmentLength?: number;
        offsetM?: number;
    }): void;

    getPoint(side: PrimitiveSide) {
        return side === 'start' ? this.start : this.end;
    }


    movePoint(side: PrimitiveSide, point: IPoint2D): void {
        if (side === 'start') {
            this.start = point;
        } else {
            this.end = point;
        }
    }

}
