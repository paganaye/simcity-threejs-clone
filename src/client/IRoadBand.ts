export type RoadType = 'old' | 'new';

interface IRoadBandBase {
    widthM: number;
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

const kerbs = bands('kerb', {
    'parallelParking': {
        color: 'asphalt',
        widthM: 2.4,
    },
    'perpendicularParking': {
        color: 'asphalt',
        widthM: 5.0,
    },
    'emergencyLane': {
        color: '#2b2b2b',
        widthM: 3.5,
    },
    'line': {
        color: RoadConstants.yellowLine,
        widthM: 0.4,
    },
    'none': {
        color: 'transparent',
        widthM: 0,
    }
});

export type KerbType = keyof typeof kerbs;

const sidewalks = bands('sidewalk', {
    'small': {
        color: RoadConstants.walkWay,
        widthM: 1.0,
    },
    'large': {
        color: RoadConstants.walkWay,
        widthM: 2.0,
    },
    'grass': {
        color: RoadConstants.grass,
        widthM: 1.0,
    },
    'none': {
        color: 'transparent',
        widthM: 0,
    }
})

export type SideWalkType = keyof typeof sidewalks;

export const lanes = bands('lane', {
    'narrow': {
        color: 'asphalt',
        widthM: 3.0,
    },
    'normal': {
        color: 'asphalt',
        widthM: 3.5,
    },
    'wide': {
        color: 'asphalt',
        widthM: 4.0,
    }
})

export type Lane = keyof typeof lanes;

export const laneSeparators = bands('laneSeparator', {
    'plain': {
        color: RoadConstants.yellowLine,
        widthM: 0.5,
    },
    'discontinuous': {
        color: RoadConstants.yellowLine,
        widthM: 0.5,
    }
})

export type LaneSeparator = keyof typeof laneSeparators;

type BandsWithType<T extends Record<string, IRoadBandBase>, K extends RoadBandKind> = {
    [P in keyof T]: T[P] & { type: P, kind: K }
};

export type RoadBandKind = 'sidewalk' | 'kerb' | 'lane' | 'laneSeparator';

function bands<K extends RoadBandKind, T extends Record<string, IRoadBandBase>>(kind: K, allBands: T): BandsWithType<T, K> {
    const result = {} as BandsWithType<T, K>;
    for (const key in allBands) {
        result[key] = { ...allBands[key], type: key, kind };
    }
    return result;
}

export type BandType = SideWalkType | KerbType | Lane | LaneSeparator;

export interface IRoadBand {
    type: BandType,
    kind: RoadBandKind;
    widthM: number;
    color: string;
}

export const roadBands = {
    ...sidewalks,
    ...kerbs,
    ...lanes,
    ...laneSeparators
};

