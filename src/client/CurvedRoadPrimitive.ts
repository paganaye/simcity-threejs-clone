import type { IRoadCuts } from './RoadBuilder';
import { RoadPrimitive, IPointXZ } from './RoadPrimitiveCompiler';
import type { IRoadType } from './roads/IRoad';


export class CurvedRoadPrimitive extends RoadPrimitive {
    transient!: boolean;
    direction!: 'forward' | 'backward';
    start!: IPointXZ;
    mid!: IPointXZ;
    end!: IPointXZ;
    roadType!: IRoadType;
    cuts?: IRoadCuts;
}
