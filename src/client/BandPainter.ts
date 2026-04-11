import { IRoadBand, RoadConstants } from './IRoadBand';
import { RoadBuilder } from './RoadBuilder';
import { IRoadOptions } from './roads/IRoad';


export class BandPainter {
    roadColor: string = "";
    currentX: number = 0;
    textureWidth!: number;
    textureHeight!: number;

    constructor(private readonly ctx: CanvasRenderingContext2D, readonly road: IRoadOptions) {
        this.roadColor = road.roadColor === 'new' ? RoadBuilder.NEW_ROAD_COLOR : RoadBuilder.OLD_ROAD_COLOR;
    }

    drawBands(bands: IRoadBand[]) {
        this.textureWidth = this.ctx.canvas.width;
        this.textureHeight = this.ctx.canvas.height;
        this.drawRect('transparent', 0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        for (const band of bands) {
            this.drawBand(band);
        }
    }

    drawRect(color: string, x: number, y: number, w: number, h: number): void {
        if (w <= 0 || h <= 0 || !color) return;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(this.currentX + x, y, w, h);
    }


    drawBand(band: IRoadBand): void {
        let widthPx = RoadBuilder.metersToPixels(band.widthM);
        if (widthPx <= 0) return;

        let drawRectPc = (color: string, x: number, y: number, w: number, h: number) => {
            if (color === 'asphalt') color = this.roadColor;
            this.drawRect(color, x * widthPx, y * this.textureHeight, w * widthPx, h * this.textureHeight);
        }

        switch (band.type) {
            case 'line':
            case 'discontinuous':
                drawRectPc(this.roadColor, 0, 0, 1, 1);
                drawRectPc(band.color, 1 / 4, 0.25, 1 / 2, 0.5);
                break;
            case 'parallelParking':
                drawRectPc(band.color, 0, 0, 1, 1);
                drawRectPc(RoadConstants.whiteLine, 0, 0, 1, (1 / 32));
                drawRectPc(RoadConstants.whiteLine, 0, (1 / 2), 1, (1 / 32));
                drawRectPc(RoadConstants.whiteLine, 0, 0, RoadConstants.yellowLinePx, 0.1);
                drawRectPc(RoadConstants.whiteLine, 0, 0.4, RoadConstants.yellowLinePx, 0.2);
                drawRectPc(RoadConstants.whiteLine, 0, (1 - 0.1), RoadConstants.yellowLinePx, 0.1);
                break;
            case 'perpendicularParking':
                drawRectPc(band.color, 0, 0, 1, 1);
                drawRectPc(RoadConstants.whiteLine, 0, 0, 1, (1 / 32));
                drawRectPc(RoadConstants.whiteLine, 0, (1 / 4), 1, (1 / 32));
                drawRectPc(RoadConstants.whiteLine, 0, (2 / 4), 1, (1 / 32));
                drawRectPc(RoadConstants.whiteLine, 0, (3 / 4), 1, (1 / 32));
                break;
            default:
                let color = band.color = band.color;
                if (color) drawRectPc(color, 0, 0, 1, 1);
        }

        this.currentX += widthPx;
    }
}
