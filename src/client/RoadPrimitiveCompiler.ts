import type { IRoad } from './roads/IRoad';
import type { IRoadCuts } from './RoadBuilder';
import { RoadSegment } from './RoadSegment';

const DEFAULT_ROAD: IRoad = {
    forward: {
        roadColor: 'old',
        lanes: 1,
        rightKerb: 'none',
        rightSidewalk: 'none',
        laneWidth: 'normal',
        leftKerb: 'none',
        leftSidewalk: 'none',
    },
    gapSize: 0,
};


export type RoadPrimitive =
    | {
        type: 'straight';
        id: string;
        transient: boolean;
        startX: number;
        startZ: number;
        endX: number;
        endZ: number;
        road: IRoad;
        cuts?: { forwardCuts?: IRoadCuts; backwardCuts?: IRoadCuts };
    }
    | {
        type: 'arc';
        id: string;
        transient: boolean;
        startX: number;
        startZ: number;
        midX: number;
        midZ: number;
        endX: number;
        endZ: number;
        road: IRoad;
    };

export class RoadPrimitiveCompiler {
    compileSegment(segment: RoadSegment): RoadPrimitive {
        const candidate = segment as unknown as {
            group?: { id?: number | string };
            getIRoad?: () => IRoad;
        };
        const id = String(candidate.group?.id ?? 'unknown');
        const road = candidate.getIRoad ? candidate.getIRoad() : DEFAULT_ROAD;
        if (segment.arcMidX !== undefined && segment.arcMidZ !== undefined) {
            return {
                type: 'arc',
                id,
                transient: false,
                startX: segment.startX,
                startZ: segment.startZ,
                midX: segment.arcMidX,
                midZ: segment.arcMidZ,
                endX: segment.endX,
                endZ: segment.endZ,
                road,
            };
        }

        return {
            type: 'straight',
            id,
            transient: false,
            startX: segment.startX,
            startZ: segment.startZ,
            endX: segment.endX,
            endZ: segment.endZ,
            road,
        };
    }

    compileTransientJoinArc(params: {
        id: string;
        startX: number;
        startZ: number;
        midX: number;
        midZ: number;
        endX: number;
        endZ: number;
        road: IRoad;
    }): RoadPrimitive {
        return {
            type: 'arc',
            id: params.id,
            transient: true,
            startX: params.startX,
            startZ: params.startZ,
            midX: params.midX,
            midZ: params.midZ,
            endX: params.endX,
            endZ: params.endZ,
            road: params.road,
        };
    }
}
