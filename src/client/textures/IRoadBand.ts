export type RoadType = 'old' | 'new';

export const RoadConstants = {
    whiteLine: '#ffffff',
    yellowLinePx: 2,
    asphalt: '#2b2b2b',
    grass: '#4e9d4e',
    yellowLine: '#d5d59f',
    walkWay: '#8d8d95',
}

export type RoadBandKind = 'sidewalk' | 'kerb' | 'lane' | 'laneSeparator';

export interface IBandPaintContext {
    roadColor: string;
    drawRectPc: (color: string, x: number, y: number, w: number, h: number) => void;
}

export class RoadBand {
    constructor(
        public readonly kind: RoadBandKind,
        public readonly type: string,
        public readonly widthM: number,
        public readonly color: string,
    ) { }

    paint(ctx: IBandPaintContext): void {
        if (this.color) {
            ctx.drawRectPc(this.color, 0, 0, 1, 1);
        }
    }
}

export class SimpleColorBand extends RoadBand {
    constructor(color: string);
    constructor(kind: RoadBandKind, type: string, widthM: number, color: string);
    constructor(kindOrColor: RoadBandKind | string, type?: string, widthM?: number, color?: string) {
        if (type !== undefined && widthM !== undefined && color !== undefined) {
            super(kindOrColor as RoadBandKind, type, widthM, color);
            return;
        }

        super('sidewalk', 'custom', 1, kindOrColor);
    }
}

export class CenterStripeBand extends RoadBand {
    constructor(kind: RoadBandKind, type: string, widthM: number, color: string) {
        super(kind, type, widthM, color);
    }

    override paint(ctx: IBandPaintContext): void {
        ctx.drawRectPc(ctx.roadColor, 0, 0, 1, 1);
        ctx.drawRectPc(this.color, 1 / 4, 0, 1 / 2, 1);
    }
}

export class DiscontinuousStripeBand extends RoadBand {
    constructor(kind: RoadBandKind, type: string, widthM: number, color: string) {
        super(kind, type, widthM, color);
    }

    override paint(ctx: IBandPaintContext): void {
        ctx.drawRectPc(ctx.roadColor, 0, 0, 1, 1);
        ctx.drawRectPc(this.color, 1 / 4, 0.25, 1 / 2, 0.5);
    }
}

export class ParallelParkingBand extends RoadBand {
    constructor(type: string, widthM: number, color: string) {
        super('kerb', type, widthM, color);
    }

    override paint(ctx: IBandPaintContext): void {
        ctx.drawRectPc(this.color, 0, 0, 1, 1);
        ctx.drawRectPc(RoadConstants.whiteLine, 0, 0, 1, 1 / 32);
        ctx.drawRectPc(RoadConstants.whiteLine, 0, 1 / 2, 1, 1 / 32);
        ctx.drawRectPc(RoadConstants.whiteLine, 0, 0, RoadConstants.yellowLinePx, 0.1);
        ctx.drawRectPc(RoadConstants.whiteLine, 0, 0.4, RoadConstants.yellowLinePx, 0.2);
        ctx.drawRectPc(RoadConstants.whiteLine, 0, 1 - 0.1, RoadConstants.yellowLinePx, 0.1);
    }
}

export class PerpendicularParkingBand extends RoadBand {
    constructor(type: string, widthM: number, color: string) {
        super('kerb', type, widthM, color);
    }

    override paint(ctx: IBandPaintContext): void {
        ctx.drawRectPc(this.color, 0, 0, 1, 1);
        ctx.drawRectPc(RoadConstants.whiteLine, 0, 0, 1, 1 / 32);
        ctx.drawRectPc(RoadConstants.whiteLine, 0, 1 / 4, 1, 1 / 32);
        ctx.drawRectPc(RoadConstants.whiteLine, 0, 2 / 4, 1, 1 / 32);
        ctx.drawRectPc(RoadConstants.whiteLine, 0, 3 / 4, 1, 1 / 32);
    }
}
const kerbs = {
    parallelParking: new ParallelParkingBand('parallelParking', 2.4, 'asphalt'),
    perpendicularParking: new PerpendicularParkingBand('perpendicularParking', 5.0, 'asphalt'),
    emergencyLane: new SimpleColorBand('kerb', 'emergencyLane', 3.5, '#2b2b2b'),
    line: new DiscontinuousStripeBand('kerb', 'line', 0.4, RoadConstants.yellowLine),
    none: new SimpleColorBand('kerb', 'none', 0, 'transparent'),
} as const;

export type KerbType = keyof typeof kerbs;

const sidewalks = {
    small: new SimpleColorBand('sidewalk', 'small', 1.0, RoadConstants.walkWay),
    large: new SimpleColorBand('sidewalk', 'large', 2.0, RoadConstants.walkWay),
    grass: new SimpleColorBand('sidewalk', 'grass', 1.0, RoadConstants.grass),
    none: new SimpleColorBand('sidewalk', 'none', 0, 'transparent'),
} as const;

export type SideWalkType = keyof typeof sidewalks;

export const lanes = {
    narrow: new SimpleColorBand('lane', 'narrow', 3.0, 'asphalt'),
    normal: new SimpleColorBand('lane', 'normal', 3.5, 'asphalt'),
    wide: new SimpleColorBand('lane', 'wide', 4.0, 'asphalt'),
} as const;

export type Lane = keyof typeof lanes;

export const laneSeparators = {
    plain: new CenterStripeBand('laneSeparator', 'plain', 0.5, RoadConstants.yellowLine),
    discontinuous: new DiscontinuousStripeBand('laneSeparator', 'discontinuous', 0.5, RoadConstants.yellowLine),
} as const;

export type LaneSeparator = keyof typeof laneSeparators;

export type BandType = SideWalkType | KerbType | Lane | LaneSeparator;


export const roadBands = {
    ...sidewalks,
    ...kerbs,
    ...lanes,
    ...laneSeparators
} as const;

