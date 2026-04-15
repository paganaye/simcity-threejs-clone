import { BandType, Lane, laneSeparators, RoadBand, roadBands } from '../textures/RoadBand';
import { IRoadType } from './IRoad';

/*

export interface IRoadBands {
    bands: RoadBand[];
    totalWidthM: number;
    carriagewayStartM: number;
    carriagewayEndM: number;
    carriagewayWidthM: number;
}




export function getBands(options: IRoadType): IRoadBands {

}


*/

export class RoadBands {
    private static cache: Map<string, RoadBands> = new Map();

    readonly bands: RoadBand[];
    readonly totalWidthM: number;
    readonly carriagewayStartM: number;
    readonly carriagewayEndM: number;
    readonly carriagewayWidthM: number;

    private constructor(options: IRoadType) {
        const laneCount = Math.max(0, options.lanes);
        const laneType: Lane = 'normal';

        let bands: RoadBand[] = [];

        function addBand(type: BandType | undefined): void {
            let band = type ? roadBands[type] : null;
            if (band) bands.push(band);
        }

        addBand(options.leftSidewalk);
        addBand(options.leftKerb);

        for (let laneIndex = 0; laneIndex < laneCount; laneIndex++) {
            addBand(laneType);
            if (laneIndex < laneCount - 1) {
                bands.push(laneSeparators.discontinuous);
            }
        }
        addBand(options.rightKerb);
        addBand(options.rightSidewalk);

        let offsetM = 0;
        let carriagewayStartM;
        let carriagewayEndM;

        for (const band of bands) {
            const isCarriageway = band.kind === 'lane' || band.kind === 'laneSeparator';
            if (isCarriageway) {
                if (carriagewayStartM === undefined) carriagewayStartM = offsetM;
                carriagewayEndM = offsetM + band.widthM;
            }
            offsetM += band.widthM;
        }

        this.bands = bands;
        this.totalWidthM = offsetM;
        this.carriagewayStartM = carriagewayStartM ?? 0;
        this.carriagewayEndM = carriagewayEndM ?? 0,
            this.carriagewayWidthM = (carriagewayEndM !== undefined && carriagewayStartM !== undefined) ? (carriagewayEndM - carriagewayStartM) : 0;

    }


    static get(options: IRoadType): RoadBands {
        const key = JSON.stringify(options);
        let bands = this.cache.get(key);
        if (!bands) {
            bands = new RoadBands(options);
            this.cache.set(key, bands);
        }
        return bands;
    }

    classGuard() { }
}


