import type { IRoadCuts } from '../textures/RoadBuilder';
import { RoadPrimitive, IPointXZ } from './RoadPrimitiveCompiler';
import type { IRoadType } from './IRoad';


export class CurvedRoadPrimitive extends RoadPrimitive {
    transient!: boolean;
    direction!: 'forward' | 'backward';
    start!: IPointXZ;
    mid!: IPointXZ;
    end!: IPointXZ;
    roadType!: IRoadType;
    cuts?: IRoadCuts;
}
