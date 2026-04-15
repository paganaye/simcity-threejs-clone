import * as THREE from 'three';
import type { IRoadCuts } from './RoadCuts';
import type { IRoadType } from './IRoad';
import { IPoint2D } from '../../sim/Geometry';
import type { RoadSegment } from './RoadSegment';
import { RoadJoin } from './RoadJoin';


export type PrimitiveSide = 'entry' | 'exit';

export abstract class PrimitiveEndPoint implements IPoint2D {
    x: number = 0;
    y?: number = 0;
    z: number = 0;

    readonly abstract side: PrimitiveSide;
    constructor(readonly primitive: RoadPrimitive) { }

    isPrimitiveEndPoint(): boolean { return true; }
    roadJoin?: RoadJoin | null;

    move(point: IPoint2D, raiseEvent: boolean = true): void {
        this.x = point.x;
        this.y = point.y;
        this.z = point.z;
        if (raiseEvent) {
            this.primitive.onRoadMoved();
        }
    }

    disposeJoin() {
        this.roadJoin?.dispose();
        this.roadJoin = null;
    }
}

export class PrimitiveEntry extends PrimitiveEndPoint {
    override readonly side = 'entry';
}
export class PrimitiveExit extends PrimitiveEndPoint {
    override readonly side = 'exit';
}


export abstract class RoadPrimitive {
    transient: boolean;
    roadType: IRoadType;
    cuts?: IRoadCuts;

    //    entryJoinPrimitive?: JoiningRoadPrimitive | null;
    //    exitJoinPrimitive?: JoiningRoadPrimitive | null;
    isDisposed: boolean = false;

    private mesh?: THREE.Object3D | null;
    readonly parent: THREE.Object3D<THREE.Object3DEventMap>;
    readonly segment?: RoadSegment;

    protected constructor(params: {
        parent: THREE.Object3D;
        segment?: RoadSegment;
        transient: boolean;
        start: IPoint2D;
        end: IPoint2D;
        roadType: IRoadType;
        cuts?: IRoadCuts;
    }) {
        this.parent = params.parent;
        this.segment = params.segment;
        this.transient = params.transient;
        this.entry.x = params.start.x;
        this.entry.y = params.start.y;
        this.entry.z = params.start.z;
        this.exit.x = params.end.x;
        this.exit.y = params.end.y;
        this.exit.z = params.end.z;
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
        //this.mesh.dispose();
        this.mesh.parent?.remove(this.mesh);
        this.mesh = null;
    }

    dispose(): void {
        if (this.isDisposed) return;
        this.isDisposed = true;

        this.entry.roadJoin?.dispose();
        this.entry.roadJoin = null;
        this.exit.roadJoin?.dispose();
        this.exit.roadJoin = null;
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

    entry: PrimitiveEntry = new PrimitiveEntry(this);
    exit: PrimitiveExit = new PrimitiveExit(this);

    abstract createGeometry(params?: {
        y?: number;
        textureProgressV?: number;
        lineLength?: number;
        segmentLength?: number;
    }): THREE.BufferGeometry | null;

    protected abstract createMesh(): THREE.Object3D | null;

    getPoint(side: PrimitiveSide) {
        return side === 'entry' ? this.entry : this.exit;
    }

    move(start: IPoint2D, end: IPoint2D): void {
        this.entry.move(start, false);
        this.exit.move(end, false);
        this.onRoadMoved();
    }

    onRoadMoved(): void {
        this.entry.roadJoin?.onAdjacentRoadMoved();
        this.exit.roadJoin?.onAdjacentRoadMoved();
        this.recreateMesh();
    }
}
