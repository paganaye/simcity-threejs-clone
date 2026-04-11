import { RoadType, KerbType, SideWalkType, Lane } from "../IRoadBand";

export interface IRoadType {
    roadColor: RoadType;
    lanes: number;
    rightKerb: KerbType;
    rightSidewalk: SideWalkType;
    laneWidth: Lane;
    leftKerb: KerbType;
    leftSidewalk: SideWalkType;
}

// static OLD_ROAD_COLOR = 'hsl(0, 2%, 7%)';
// static NEW_ROAD_COLOR = 'hsl(0, 2%, 3.5%)';
// oldRoadColor: this.OLD_ROAD_COLOR,
// newRoadColor: this.NEW_ROAD_COLOR,
// static NARROW_LANE_WIDTH_M = 3.0;
// static NORMAL_LANE_WIDTH_M = 3.5;
// static WIDE_LANE_WIDTH_M = 4.25;


export type IRoad = {
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
    road: IRoad;
}

export interface IRoadNetwork {
    roads: IRoadInstruction[];
}
