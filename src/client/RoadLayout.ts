import type { IRoad, IRoadOptions, KerbType, LaneWidth, SideWalkType } from './roads/IRoad';

export type RoadBandKind = 'asphalt' | 'laneDivider' | 'parallelParking' | 'perpendicularParking' | 'sidewalk' | 'grass' | 'gap';

export interface IRoadBandLayout {
    kind: RoadBandKind;
    widthM: number;
    color: string;
}

export interface IRoadCrossSection {
    bands: IRoadBandLayout[];
    totalWidthM: number;
    carriagewayStartM: number;
    carriagewayEndM: number;
    carriagewayWidthM: number;
}

export interface IRoadLayoutMetrics {
    oldRoadColor: string;
    newRoadColor: string;
    sidewalkColor: string;
    grassColor: string;
    yellowLineColor: string;
    whiteLineColor: string;
    yellowLineWidthM: number;
    emergencyLaneWidthM: number;
    parallelParkingWidthM: number;
    perpendicularParkingWidthM: number;
    smallSidewalkM: number;
    largeSidewalkM: number;
    grassWidthM: number;
    narrowLaneWidthM: number;
    normalLaneWidthM: number;
    wideLaneWidthM: number;
}

export interface IJunctionArm {
    road: IRoad;
    angleRad: number;
    crossSection: IRoadCrossSection;
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
}

export interface IJunctionTextureResult {
    canvas: HTMLCanvasElement;
    widthPx: number;
    heightPx: number;
    widthM: number;
    heightM: number;
}

export function getLaneWidthMeters(laneWidth: LaneWidth, metrics: IRoadLayoutMetrics): number {
    switch (laneWidth) {
        case 'narrow': return metrics.narrowLaneWidthM;
        case 'wide': return metrics.wideLaneWidthM;
        default: return metrics.normalLaneWidthM;
    }
}

function getRoadColor(options: IRoadOptions, metrics: IRoadLayoutMetrics): string {
    return options.roadColor === 'new' ? metrics.newRoadColor : metrics.oldRoadColor;
}

function getSidewalkBand(sidewalk: SideWalkType | undefined, metrics: IRoadLayoutMetrics): IRoadBandLayout | null {
    switch (sidewalk) {
        case 'small':
            return { kind: 'sidewalk', widthM: metrics.smallSidewalkM, color: metrics.sidewalkColor };
        case 'large':
            return { kind: 'sidewalk', widthM: metrics.largeSidewalkM, color: metrics.sidewalkColor };
        case 'grass':
            return { kind: 'grass', widthM: metrics.grassWidthM, color: metrics.grassColor };
        case 'none':
        case undefined:
            return null;
        default:
            throw new Error('sidewalk not implemented yet');
    }
}

function getKerbBands(kerb: KerbType | undefined, side: 'left' | 'right', roadColor: string, metrics: IRoadLayoutMetrics): IRoadBandLayout[] {
    switch (kerb) {
        case 'parallelParking':
            return [{ kind: 'parallelParking', widthM: metrics.parallelParkingWidthM, color: roadColor }];
        case 'perpendicularParking':
            return [{ kind: 'perpendicularParking', widthM: metrics.perpendicularParkingWidthM, color: roadColor }];
        case 'emergencyLane':
            return side === 'left'
                ? [
                    { kind: 'asphalt', widthM: metrics.emergencyLaneWidthM, color: roadColor },
                    { kind: 'laneDivider', widthM: metrics.yellowLineWidthM, color: metrics.yellowLineColor },
                ]
                : [
                    { kind: 'laneDivider', widthM: metrics.yellowLineWidthM, color: metrics.yellowLineColor },
                    { kind: 'asphalt', widthM: metrics.emergencyLaneWidthM, color: roadColor },
                ];
        case 'line':
            return side === 'left'
                ? [
                    { kind: 'asphalt', widthM: metrics.yellowLineWidthM, color: roadColor },
                    { kind: 'laneDivider', widthM: metrics.yellowLineWidthM, color: metrics.yellowLineColor },
                ]
                : [
                    { kind: 'laneDivider', widthM: metrics.yellowLineWidthM, color: metrics.yellowLineColor },
                    { kind: 'asphalt', widthM: metrics.yellowLineWidthM, color: roadColor },
                ];
        case 'gap':
            return [{ kind: 'asphalt', widthM: metrics.yellowLineWidthM, color: roadColor }];
        case 'none':
        case undefined:
            return [];
        default:
            return [];
    }
}

function withComputedMetrics(bands: IRoadBandLayout[]): IRoadCrossSection {
    const totalWidthM = bands.reduce((acc, band) => acc + band.widthM, 0);
    let offsetM = 0;
    let carriagewayStartM = -1;
    let carriagewayEndM = -1;

    for (const band of bands) {
        const isCarriageway = band.kind === 'asphalt' || band.kind === 'laneDivider' || band.kind === 'parallelParking' || band.kind === 'perpendicularParking';
        if (isCarriageway) {
            if (carriagewayStartM < 0) {
                carriagewayStartM = offsetM;
            }
            carriagewayEndM = offsetM + band.widthM;
        }
        offsetM += band.widthM;
    }

    if (carriagewayStartM < 0 || carriagewayEndM < 0) {
        carriagewayStartM = 0;
        carriagewayEndM = 0;
    }

    return {
        bands,
        totalWidthM,
        carriagewayStartM,
        carriagewayEndM,
        carriagewayWidthM: carriagewayEndM - carriagewayStartM,
    };
}

function mirrorCrossSection(crossSection: IRoadCrossSection): IRoadCrossSection {
    return withComputedMetrics([...crossSection.bands].reverse());
}

export function buildRoadCrossSection(options: IRoadOptions, metrics: IRoadLayoutMetrics): IRoadCrossSection {
    const roadColor = getRoadColor(options, metrics);
    const laneWidthM = getLaneWidthMeters(options.laneWidth, metrics);
    const laneCount = Math.max(0, options.lanes);
    const bands: IRoadBandLayout[] = [];

    const leftSidewalk = getSidewalkBand(options.leftSidewalk, metrics);
    if (leftSidewalk) bands.push(leftSidewalk);

    bands.push(...getKerbBands(options.leftKerb, 'left', roadColor, metrics));

    for (let laneIndex = 0; laneIndex < laneCount; laneIndex++) {
        bands.push({ kind: 'asphalt', widthM: laneWidthM, color: roadColor });
        if (laneIndex < laneCount - 1) {
            bands.push({ kind: 'laneDivider', widthM: metrics.yellowLineWidthM, color: metrics.yellowLineColor });
        }
    }

    bands.push(...getKerbBands(options.rightKerb, 'right', roadColor, metrics));

    const rightSidewalk = getSidewalkBand(options.rightSidewalk, metrics);
    if (rightSidewalk) bands.push(rightSidewalk);

    return withComputedMetrics(bands);
}

export function buildCompositeRoadCrossSection(road: IRoad, metrics: IRoadLayoutMetrics): IRoadCrossSection {
    const forward = buildRoadCrossSection(road.forward, metrics);
    const backward = road.backward ? mirrorCrossSection(buildRoadCrossSection(road.backward, metrics)) : null;
    const gapWidthM = backward ? Math.max(0, road.gapSize || 0) : 0;

    const bands = backward
        ? [...backward.bands, ...(gapWidthM > 0 ? [{ kind: 'gap' as const, widthM: gapWidthM, color: 'transparent' }] : []), ...forward.bands]
        : [...forward.bands];

    return withComputedMetrics(bands);
}

export function buildCrossJunctionGeometry(
    mainRoad: IRoad,
    crossingRoad: IRoad,
    metrics: IRoadLayoutMetrics,
    options?: IJunctionTextureOptions,
): IJunctionGeometry {
    const mainCrossSection = buildCompositeRoadCrossSection(mainRoad, metrics);
    const crossingCrossSection = buildCompositeRoadCrossSection(crossingRoad, metrics);
    const approachLengthM = Math.max(0, options?.approachLengthM ?? 8);
    const intersectionWidthM = crossingCrossSection.carriagewayWidthM;
    const intersectionHeightM = mainCrossSection.carriagewayWidthM;

    return {
        centerX: 0,
        centerZ: 0,
        arms: [
            { road: mainRoad, angleRad: 0, crossSection: mainCrossSection },
            { road: crossingRoad, angleRad: Math.PI / 2, crossSection: crossingCrossSection },
        ],
        textureWidthM: Math.max(crossingCrossSection.totalWidthM, intersectionWidthM + approachLengthM * 2),
        textureHeightM: Math.max(mainCrossSection.totalWidthM, intersectionHeightM + approachLengthM * 2),
        intersectionWidthM,
        intersectionHeightM,
        approachLengthM,
    };
}