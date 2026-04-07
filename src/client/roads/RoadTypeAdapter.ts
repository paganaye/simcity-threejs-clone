import type { IRoad, IRoadOptions } from './IRoad';

export type RoadRenderOptions = IRoadOptions & {
    gapSize: number;
};

const EMPTY_OTHER_WAY: RoadRenderOptions = {
    roadColor: 'old', lanes: 0, rightKerb: 'none', rightSidewalk: 'none', laneWidth: 'normal',
    leftKerb: 'none', leftSidewalk: 'none',
    gapSize: 0,
};

export function iRoadToRenderOptions(road: IRoad): { left: RoadRenderOptions; right: RoadRenderOptions } {
    if (road.type === 'OneWayRoad') {
        return {
            left: EMPTY_OTHER_WAY,
            right: { ...road.options, gapSize: 0 },
        };
    }
    return {
        left: { ...road.otherWay, gapSize: road.gapSize },
        right: { ...road.forwardWay, gapSize: road.gapSize },
    };
}
