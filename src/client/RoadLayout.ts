import { BandType, IRoadBand, laneSeparators, Lane, roadBands } from './IRoadBand';
import type { IRoad, IRoadOptions } from './roads/IRoad';



export interface IRoadBands {
    bands: IRoadBand[];
    totalWidthM: number;
    carriagewayStartM: number;
    carriagewayEndM: number;
    carriagewayWidthM: number;
}

export interface IJunctionArm {
    road: IRoad;
    angleRad: number;
    crossSection: IRoadBands;
}

export interface IJunctionGeometry {
    centerX: number;
    centerZ: number;
    arms: [IJunctionArm, IJunctionArm];
    textureWidthM: number;
    textureHeightM: number;
    intersectionWidthM: number;
    intersectionHeightM: number;
    approachLengthM: number;
}

export interface IJunctionTextureOptions {
    approachLengthM?: number;
    centerMarking?: 'none' | 'box';
    crosswalks?: 'none' | 'zebra';
}

export interface IJunctionTextureResult {
    canvas: HTMLCanvasElement;
    widthPx: number;
    heightPx: number;
    widthM: number;
    heightM: number;
}




export function getBands(options: IRoadOptions): IRoadBands {
    const laneCount = Math.max(0, options.lanes);
    const laneType: Lane = 'normal';

    let bands: IRoadBand[] = [];

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

    return {
        bands,
        totalWidthM: offsetM,
        carriagewayStartM: carriagewayStartM ?? 0,
        carriagewayEndM: carriagewayEndM ?? 0,
        carriagewayWidthM: (carriagewayEndM !== undefined && carriagewayStartM !== undefined) ? (carriagewayEndM - carriagewayStartM) : 0,
    };

}

// export function getRoadBands(options: IRoadOptions): IRoadBands {
//     let bands = getBands(options);
//     return calcBands(bands);
// }

// export function buildCompositeRoadCrossSection(road: IRoad): IRoadBands {
//     const forward = getRoadBands(road.forward);
//     //const backward = road.backward ? mirrorBands(getRoadBands(road.backward)) : null;
//     const gapWidthM = backward ? Math.max(0, road.gapSize || 0) : 0;

//     const bands = backward
//         ? [...backward.bands, ...(gapWidthM > 0 ? [{ type: 'gap' as const, widthM: gapWidthM, color: 'transparent' }] : []), ...forward.bands]
//         : [...forward.bands];

//     return calcBands(bands);
// }

// export function buildCrossJunctionGeometry(
//     mainRoad: IRoad,
//     crossingRoad: IRoad,
//     options?: IJunctionTextureOptions,
// ): IJunctionGeometry {
//     const mainCrossSection = getBands(mainRoad.forward);
//     const crossingCrossSection = getBands(crossingRoad);
//     const approachLengthM = Math.max(0, options?.approachLengthM ?? 8);
//     const intersectionWidthM = crossingCrossSection.carriagewayWidthM;
//     const intersectionHeightM = mainCrossSection.carriagewayWidthM;

//     return {
//         centerX: 0,
//         centerZ: 0,
//         arms: [
//             { road: mainRoad, angleRad: 0, crossSection: mainCrossSection },
//             { road: crossingRoad, angleRad: Math.PI / 2, crossSection: crossingCrossSection },
//         ],
//         textureWidthM: Math.max(crossingCrossSection.totalWidthM, intersectionWidthM + approachLengthM * 2),
//         textureHeightM: Math.max(mainCrossSection.totalWidthM, intersectionHeightM + approachLengthM * 2),
//         intersectionWidthM,
//         intersectionHeightM,
//         approachLengthM,
//     };
// }