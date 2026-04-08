import type { IRoadBandLayout } from './RoadLayout';

export type BandType = 'solid' | 'laneDivider' | 'parallelParking' | 'perpendicularParking';

export interface IRoadBand {
    type: BandType;
    width: number;
    color: string;
}

export class BandPainter {
    constructor(private readonly ctx: CanvasRenderingContext2D) {}

    rect(color: string, x: number, y: number, w: number, h: number): void {
        if (w <= 0 || h <= 0) return;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, w, h);
    }

    bandH(band: IRoadBandLayout, asphaltColor: string, x0: number, x1: number, y: number, h: number): void {
        if (x1 <= x0 || band.kind === 'gap') return;
        const w = x1 - x0;
        if (band.kind === 'laneDivider') {
            this.rect(asphaltColor, x0, y, w, h);
            this.rect(band.color, x0, y, Math.max(1, Math.round(w / 2)), h);
            return;
        }
        this.rect(band.color, x0, y, w, h);
    }

    bandV(band: IRoadBandLayout, asphaltColor: string, x: number, w: number, y0: number, y1: number): void {
        if (y1 <= y0 || band.kind === 'gap') return;
        const h = y1 - y0;
        if (band.kind === 'laneDivider') {
            this.rect(asphaltColor, x, y0, w, h);
            this.rect(band.color, x, y0, w, Math.max(1, Math.round(h / 2)));
            return;
        }
        this.rect(band.color, x, y0, w, h);
    }

    roadBand(band: IRoadBand, x: number, widthPx: number, heightPx: number, roadColor: string, whiteLine: string, yellowLinePx: number): void {
        if (widthPx <= 0) return;
        const line = (w: number, y: number, h: number, color: string) =>
            this.rect(color, x, y * heightPx, w, h * heightPx);
        switch (band.type) {
            case 'solid':
                line(widthPx, 0, 1, band.color);
                break;
            case 'laneDivider':
                line(widthPx, 0, 0.5, band.color);
                line(widthPx, 0.5, 0.5, roadColor);
                break;
            case 'parallelParking':
                line(widthPx, 0, 1, band.color);
                line(widthPx, 0, 1 / 32, whiteLine);
                line(widthPx, 1 / 2, 1 / 32, whiteLine);
                line(yellowLinePx, 0, 0.1, whiteLine);
                line(yellowLinePx, 0.4, 0.2, whiteLine);
                line(yellowLinePx, 1 - 0.1, 0.1, whiteLine);
                break;
            case 'perpendicularParking':
                line(widthPx, 0, 1, band.color);
                line(widthPx, 0, 1 / 32, whiteLine);
                line(widthPx, 1 / 4, 1 / 32, whiteLine);
                line(widthPx, 2 / 4, 1 / 32, whiteLine);
                line(widthPx, 3 / 4, 1 / 32, whiteLine);
                break;
        }
    }
}
