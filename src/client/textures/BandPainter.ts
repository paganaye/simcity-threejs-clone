import { IRoadType } from '../roads/IRoad';
import { RoadBand, RoadConstants } from './RoadBand';
import { RoadTextureBuilder } from './RoadTextureBuilder';


export class BandPainter {
    roadColor: string = "";
    currentX: number = 0;
    textureWidth!: number;
    textureHeight!: number;

    constructor(private readonly ctx: CanvasRenderingContext2D, readonly road: IRoadType) {
        this.roadColor = road.roadColor === 'new' ? RoadConstants.NEW_ROAD_COLOR : RoadConstants.OLD_ROAD_COLOR;
    }

    drawBands(bands: RoadBand[]) {
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


    drawBand(band: RoadBand): void {
        let widthPx = RoadTextureBuilder.metersToPixels(band.widthM);
        if (widthPx <= 0) return;

        let drawRectPc = (color: string, x: number, y: number, w: number, h: number) => {
            if (color === 'asphalt') color = this.roadColor;
            this.drawRect(color, x * widthPx, y * this.textureHeight, w * widthPx, h * this.textureHeight);
        }

        band.paint({
            roadColor: this.roadColor,
            drawRectPc,
        });

        this.currentX += widthPx;
    }
}
