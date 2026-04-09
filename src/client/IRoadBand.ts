export type RoadType = 'old' | 'new';

interface IRoadBandBase {
    widthM: number;
    isCarriageway?: boolean;
    color: string;
}

export const RoadConstants = {
    whiteLine: '#ffffff',
    yellowLinePx: 2,
    asphalt: '#2b2b2b',
    grass: '#4e9d4e',
    yellowLine: '#d5d59f',
    walkWay: '#8d8d95',
}

const kerbs = bands({
    'parallelParking': {
        color: 'asphalt',
        isCarriageway: true,
        widthM: 2.4,
    },
    'perpendicularParking': {
        color: 'asphalt',
        isCarriageway: true,
        widthM: 5.0,
    },
    'emergencyLane': {
        color: '#2b2b2b',
        isCarriageway: true,
        widthM: 3.5,
    },
    'line': {
        color: RoadConstants.yellowLine,
        isCarriageway: true,
        widthM: 0.4,
    },
    'none': {
        color: 'transparent',
        isCarriageway: false,
        widthM: 0,
    }
});

export type KerbType = keyof typeof kerbs;

const sidewalks = bands({
    'small': {
        color: RoadConstants.walkWay,
        isCarriageway: false,
        widthM: 1.0,
    },
    'large': {
        color: RoadConstants.walkWay,
        isCarriageway: false,
        widthM: 2.0,
    },
    'grass': {
        color: RoadConstants.grass,
        isCarriageway: false,
        widthM: 1.0,
    },
    'none': {
        color: 'transparent',
        isCarriageway: false,
        widthM: 0,
    }
})

export type SideWalkType = keyof typeof sidewalks;

export const laneWidths = bands({
    'narrow': {
        color: 'asphalt',
        isCarriageway: true,
        widthM: 3.0,
    },
    'normal': {
        color: 'asphalt',
        isCarriageway: true,
        widthM: 3.5,
    },
    'wide': {
        color: 'asphalt',
        isCarriageway: true,
        widthM: 4.0,
    }
})

export type LaneWidth = keyof typeof laneWidths;

export const laneSeparators = bands({
    'plain': {
        color: 'asphalt',
        isCarriageway: true,
        widthM: 0.5,
    },
    'discontinuous': {
        color: 'asphalt',
        isCarriageway: true,
        widthM: 0.5,
    }
})

export type LaneSeparator = keyof typeof laneSeparators;


type BandsWithType<T extends Record<string, IRoadBandBase>> = {
    [K in keyof T]: T[K] & { type: K }
};

function bands<T extends Record<string, IRoadBandBase>>(allBands: T): BandsWithType<T> {
    const entries = Object.entries(allBands).map(([type, band]) => [type, { ...band, type }]);
    return Object.fromEntries(entries) as BandsWithType<T>;
}

export type BandType = KerbType | SideWalkType | LaneWidth | LaneSeparator;

export interface IRoadBand {
    type: BandType,
    widthM: number;
    isCarriageway?: boolean;
    color: string;
}

export const roadBands = {
    ...kerbs,
    ...sidewalks,
    ...laneWidths,
    ...laneSeparators
};