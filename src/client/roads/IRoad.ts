import { RoadType, KerbType, SideWalkType, Lane } from "../textures/RoadBand";

export interface IRoadType {
    roadColor: RoadType;
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
        start: { x: number; z: number };
        end: { x: number; z: number };
    }
    | {
        type: 'arc';
        start: { x: number; z: number };
        mid: { x: number; z: number };
        end: { x: number; z: number };
    };

export interface IRoadInstruction {
    id: string;
    shape: IRoadShape;
    road: IDualRoadType;
}

export interface IRoadNetwork {
    roads: IRoadInstruction[];
}
