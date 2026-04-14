import * as THREE from 'three';
import type { IRoadCuts } from './RoadCuts';
import type { IRoadType } from './IRoad';
import { IPoint2D } from '../../sim/Geometry';
import { JoiningRoadPrimitive } from './JoiningRoadPrimitive';

export type PrimitiveSide = 'entry' | 'exit';

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

    startJoinPrimitive?: JoiningRoadPrimitive | null;
    endJoinPrimitive?: JoiningRoadPrimitive | null;
    isDisposed: boolean = false;

    private mesh?: THREE.Mesh | null;

    protected constructor(params: {
        parent: THREE.Object3D;
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

    protected initializeMesh(parent: THREE.Object3D): void {
        this.mesh = this.createMesh();
        if (this.mesh) {
            this.mesh.userData.owner = this;
            parent.add(this.mesh);
        }
    }

    protected disposeMesh(): void {
        if (!this.mesh) return;
        this.mesh.geometry.dispose();
        this.mesh.parent?.remove(this.mesh);
        this.mesh = null;
    }

    dispose(): void {
        if (this.isDisposed) return;
        this.isDisposed = true;

        const startJoin = this.startJoinPrimitive;
        const endJoin = this.endJoinPrimitive;
        this.startJoinPrimitive = null;
        this.endJoinPrimitive = null;

        startJoin?.dispose();
        endJoin?.dispose();
        this.disposeMesh();
        this.onDispose();
    }

    onDispose(): void {
    }

    recreateMesh() {
        let scene = this.mesh?.parent;
        this.disposeMesh();
        this.mesh = this.createMesh();
        if (this.mesh) {
            this.mesh.userData.owner = this;
            if (scene) scene.add(this.mesh);
        }
    }

    get start(): PrimitiveEndPoint {
        return { side: 'entry', primitive: this };
    }

    get end(): PrimitiveEndPoint {
        return { side: 'exit', primitive: this };
    }



    abstract createGeometry(params?: {
        y?: number;
        textureProgressV?: number;
        lineLength?: number;
        segmentLength?: number;
    }): THREE.BufferGeometry | null;

    protected abstract createMesh(): THREE.Mesh | null;

    getPoint(side: PrimitiveSide) {
        return side === 'entry' ? this.startPos : this.endPos;
    }


    movePoint(side: PrimitiveSide, point: IPoint2D): void {
        if (side === 'entry') {
            this.startPos = point;
        } else {
            this.endPos = point;
        }
        this.onRoadMoved();
    }

    move(start: IPoint2D, end: IPoint2D): void {
        this.startPos = start;
        this.endPos = end;
        this.onRoadMoved();
    }

    onRoadMoved(): void {
        this.startJoinPrimitive?.onRoadMoved();
        this.endJoinPrimitive?.onRoadMoved();
        this.recreateMesh();


        //this.replaceMesh(this.mesh?.parent ?? new THREE.Object3D(), this.buildMesh());
        // #rebuildMeshes(): void {
        //     if(!this.scene3DInstance || !this.minutePrimitive || !this.secondPrimitive) return;


        //     this.joinPrimitive?.clearMesh();
        //     const joinPrimitive = joinPrimitives(
        //         this.minutePrimitive,
        //         'start',
        //         this.secondPrimitive,
        //         'end',
        //         { radius: 10 },
        //     );
        //     this.minutePrimitive.createMesh(this.scene3DInstance.scene);
        //     this.secondPrimitive.createMesh(this.scene3DInstance.scene);
        //     this.joinPrimitive = joinPrimitive ?? undefined;
        //     this.joinPrimitive?.createMesh(this.scene3DInstance.scene);
        // }


    }
}
