export type KerbType = 'parallelParking' | 'perpendicularParking' | 'emergencyLane' | 'line' | 'line-hidden' | 'gap' | 'none';
export type SideWalkType = 'small' | 'small-hidden' | 'large' | 'grass' | 'none';

export type LaneWidth = 'narrow' | 'normal' | 'wide';

export interface IRoadOptions {
    roadColor: 'old' | 'new';
    lanes: number;
    rightKerb: KerbType;
    rightSidewalk: SideWalkType;
    laneWidth: LaneWidth;
    leftKerb: KerbType;
    leftSidewalk: SideWalkType;
}

export type IRoad = {
    forward: IRoadOptions;
    backward?: IRoadOptions;
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
