import { IPoint2D, IVector2D } from '../../sim/Geometry';
import { RoadJoin } from './RoadJoin';
import { RoadPrimitive } from './RoadPrimitive';

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

    direction(): IVector2D {
        return this.primitive.getDirection(this.side);
    }
}

export class PrimitiveEntry extends PrimitiveEndPoint {
    override readonly side = 'entry';
}
export class PrimitiveExit extends PrimitiveEndPoint {
    override readonly side = 'exit';
}
