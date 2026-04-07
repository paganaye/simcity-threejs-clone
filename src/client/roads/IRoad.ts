export type ShoulderType = 'parallelParking' | 'perpendicularParking' | 'emergencyLane' | 'line' | 'gap' | 'none';
export type DividingType = 'yellowLineSolid' | 'yellowLineDashed' | 'gap' | 'none';
export type SideWalkType = 'small' | 'large' | 'none';

export interface IRoadOptions {
    roadColor: 'old' | 'new';
    lanes: number;
    shoulder: ShoulderType;
    sidewalk: SideWalkType;
}

export type OneWayRoad = {
    type: 'OneWayRoad';
    options: IRoadOptions;
};

export type TwoWayRoad = {
    type: 'TwoWayRoad';
    forwardWay: IRoadOptions;
    otherWay: IRoadOptions;
    dividing: DividingType;
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
