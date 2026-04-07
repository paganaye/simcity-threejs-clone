import type { DividingType, IRoad, IRoadOptions } from './IRoad';

export type RoadType = 'none' | 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6' | 'l7';

export type RoadRenderOptions = IRoadOptions & {
    dividing: DividingType;
};

const LEGACY_ROAD_OPTIONS: Record<RoadType, RoadRenderOptions> = {
    none: { dividing: 'none', lanes: 0, shoulder: 'none', sidewalk: 'small', roadColor: 'old' },
    l1: { dividing: 'none', lanes: 1, shoulder: 'none', sidewalk: 'small', roadColor: 'old' },
    l2: { dividing: 'none', lanes: 1, shoulder: 'parallelParking', sidewalk: 'small', roadColor: 'old' },
    l3: { dividing: 'none', lanes: 1, shoulder: 'perpendicularParking', sidewalk: 'small', roadColor: 'old' },
    l4: { dividing: 'yellowLineSolid', lanes: 1, shoulder: 'line', sidewalk: 'large', roadColor: 'new' },
    l5: { dividing: 'yellowLineSolid', lanes: 2, shoulder: 'line', sidewalk: 'large', roadColor: 'new' },
    l6: { dividing: 'yellowLineSolid', lanes: 3, shoulder: 'line', sidewalk: 'large', roadColor: 'new' },
    l7: { dividing: 'yellowLineSolid', lanes: 1, shoulder: 'emergencyLane', sidewalk: 'large', roadColor: 'new' },
};

const NONE_RENDER: RoadRenderOptions = LEGACY_ROAD_OPTIONS.none;

function cloneRenderOptions(options: RoadRenderOptions): RoadRenderOptions {
    return {
        roadColor: options.roadColor,
        lanes: options.lanes,
        shoulder: options.shoulder,
        sidewalk: options.sidewalk,
        dividing: options.dividing,
    };
}

export function roadTypeToIRoad(roadType: RoadType): IRoad {
    const options = LEGACY_ROAD_OPTIONS[roadType] ?? LEGACY_ROAD_OPTIONS.l1;
    const baseOptions: IRoadOptions = {
        roadColor: options.roadColor,
        lanes: options.lanes,
        shoulder: options.shoulder,
        sidewalk: options.sidewalk,
    };

    return {
        type: 'TwoWayRoad',
        forwardWay: baseOptions,
        otherWay: baseOptions,
        dividing: options.dividing,
    };
}

export function roadTypeToRenderOptions(roadType: RoadType): RoadRenderOptions {
    const options = LEGACY_ROAD_OPTIONS[roadType] ?? LEGACY_ROAD_OPTIONS.l1;
    return cloneRenderOptions(options);
}

function findLegacyRoadType(options: RoadRenderOptions): RoadType | undefined {
    const keys = Object.keys(LEGACY_ROAD_OPTIONS) as RoadType[];
    return keys.find((key) => {
        const preset = LEGACY_ROAD_OPTIONS[key];
        return preset.roadColor === options.roadColor
            && preset.lanes === options.lanes
            && preset.shoulder === options.shoulder
            && preset.sidewalk === options.sidewalk
            && preset.dividing === options.dividing;
    });
}

export function iRoadToLegacyRoadType(road: IRoad): RoadType {
    const render = iRoadToRenderOptions(road).right;
    return findLegacyRoadType(render) ?? 'l1';
}

export function iRoadToRenderOptions(road: IRoad): { left: RoadRenderOptions; right: RoadRenderOptions } {
    if (road.type === 'OneWayRoad') {
        return {
            left: cloneRenderOptions(NONE_RENDER),
            right: {
                roadColor: road.options.roadColor,
                lanes: road.options.lanes,
                shoulder: road.options.shoulder,
                sidewalk: road.options.sidewalk,
                dividing: 'none',
            },
        };
    }

    return {
        left: {
            roadColor: road.otherWay.roadColor,
            lanes: road.otherWay.lanes,
            shoulder: road.otherWay.shoulder,
            sidewalk: road.otherWay.sidewalk,
            dividing: road.dividing,
        },
        right: {
            roadColor: road.forwardWay.roadColor,
            lanes: road.forwardWay.lanes,
            shoulder: road.forwardWay.shoulder,
            sidewalk: road.forwardWay.sidewalk,
            dividing: road.dividing,
        },
    };
}
