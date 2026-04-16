import { IPoint2D } from "../../sim/Geometry";
import { RoadColor, KerbType, SideWalkType, Lane } from "../textures/RoadBand";

export interface IRoadType {
    roadColor: RoadColor;
    lanes: number;
    rightKerb: KerbType;
    rightSidewalk: SideWalkType;
    laneWidth: Lane;
    leftKerb: KerbType;
    leftSidewalk: SideWalkType;
}

export type IDualRoadType = {
    forward: IRoadType;
    backward?: IRoadType;
    gapSize: number; // metre
};

export type IRoadShape =
    | {
        type: 'line';
        start: IPoint2D;
        end: IPoint2D;
    }
    | {
        type: 'arc';
        start: IPoint2D;
        mid: IPoint2D;
        end: IPoint2D;
    };

export interface IRoadInstruction {
    id: string;
    shape: IRoadShape;
    road: IDualRoadType;
}

export interface IRoadNetwork {
    roads: IRoadInstruction[];
}
