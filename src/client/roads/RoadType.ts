import { RoadBand, Lane, BandType, roadBands, laneSeparators } from '../textures/RoadBand';
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

export class RoadType {
    private static cache: Map<string, RoadType> = new Map();
    readonly bands: RoadBand[];
    readonly outerWidth: number;
    readonly carriagewayStart: number;
    readonly midCarriageway: number;
    readonly carriagewayEnd: number;
    readonly carriagewayWidth: number;

    private constructor(readonly roadType: IRoadType) {
        const laneCount = Math.max(0, roadType.lanes);
        const laneType: Lane = 'normal';

        let bands: RoadBand[] = [];

        function addBand(type: BandType | undefined): void {
            let band = type ? roadBands[type] : null;
            if (band) bands.push(band);
        }

        addBand(roadType.leftSidewalk);
        addBand(roadType.leftKerb);

        for (let laneIndex = 0; laneIndex < laneCount; laneIndex++) {
            addBand(laneType);
            if (laneIndex < laneCount - 1) {
                bands.push(laneSeparators.discontinuous);
            }
        }
        addBand(roadType.rightKerb);
        addBand(roadType.rightSidewalk);

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
        this.outerWidth = offsetM;
        this.carriagewayStart = carriagewayStartM ?? 0;
        this.carriagewayEnd = carriagewayEndM ?? 0;
        this.carriagewayWidth = (carriagewayEndM !== undefined && carriagewayStartM !== undefined)
            ? (carriagewayEndM - carriagewayStartM) : 0;
        this.midCarriageway = (this.carriagewayStart + this.carriagewayEnd) / 2;
    }


    static get(options: IRoadType): RoadType {
        const key = JSON.stringify(options);
        let roadType = this.cache.get(key);
        if (!roadType) {
            roadType = new RoadType(options);
            this.cache.set(key, roadType);
        }
        return roadType;
    }

    classGuard() { }
}
