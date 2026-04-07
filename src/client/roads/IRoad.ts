export type KerbType = 'parallelParking' | 'perpendicularParking' | 'emergencyLane' | 'line' | 'gap' /*| 'entry' | 'exit'*/ | 'none';
export type SideWalkType = 'small' | 'large' | 'none';

export interface IRoadOptions {
    roadColor: 'old' | 'new';
    lanes: number;
    rightKerb: KerbType;
    rightSidewalk: SideWalkType;
    laneWidth: 'narrow' | 'normal' | 'wide';
    leftKerb: KerbType;
    leftSidewalk: SideWalkType;
}

export type OneWayRoad = {
    type: 'OneWayRoad';
    options: IRoadOptions;
};

export type TwoWayRoad = {
    type: 'TwoWayRoad';
    forwardWay: IRoadOptions;
    otherWay: IRoadOptions;
    gapSize: number; // metre
};

export type IRoad = OneWayRoad | TwoWayRoad;

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
