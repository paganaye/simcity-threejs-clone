import type { IRoadCuts } from '../textures/RoadBuilder';
import { RoadPrimitive, IPointXZ } from './RoadPrimitiveCompiler';
import type { IRoadType } from './IRoad';


export class StraightRoadPrimitive extends RoadPrimitive {
    transient!: boolean;
    direction!: 'forward' | 'backward';
    start!: IPointXZ;
    end!: IPointXZ;
    roadType!: IRoadType;
    cuts?: IRoadCuts;
}
