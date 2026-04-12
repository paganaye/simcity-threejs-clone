import type { IRoad, IRoadType } from './IRoad';
import type { IRoadCuts } from './RoadCuts';
import { StraightRoadPrimitive } from './StraightRoadPrimitive';
import { RoadPrimitive } from './RoadPrimitive';
import { IPoint2D } from '../../sim/IPoint';
import { CurvedRoadPrimitive } from './CurvedRoadPrimitive';
import { RoadSegment } from './RoadSegment';

export type IPointXZ = Pick<IPoint2D, 'x' | 'z'>;

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

export class RoadPrimitiveCompiler {
    compileSegment(segment: RoadSegment): RoadPrimitive[] {
        const candidate = segment as unknown as {
            group?: { id?: number | string };
            getIRoad?: () => IRoad;
            getJunctionCuts?: () => { forwardCuts?: IRoadCuts; backwardCuts?: IRoadCuts } | undefined;
        };

        const road = candidate.getIRoad ? candidate.getIRoad() : DEFAULT_ROAD;
        const cuts = candidate.getJunctionCuts ? candidate.getJunctionCuts() : undefined;
        const result: RoadPrimitive[] = [];

        if (segment.arcMidX !== undefined && segment.arcMidZ !== undefined) {
            result.push(new CurvedRoadPrimitive({
                transient: false,
                direction: 'forward',
                start: { x: segment.startX, z: segment.startZ },
                mid: { x: segment.arcMidX, z: segment.arcMidZ },
                end: { x: segment.endX, z: segment.endZ },
                roadType: road.forward,
                cuts: cuts?.forwardCuts,
            }));

            if (road.backward) {
                result.push(new CurvedRoadPrimitive({
                    transient: false,
                    direction: 'backward',
                    start: { x: segment.endX, z: segment.endZ },
                    mid: { x: segment.arcMidX, z: segment.arcMidZ },
                    end: { x: segment.startX, z: segment.startZ },
                    roadType: road.backward,
                    cuts: cuts?.backwardCuts,
                }));
            }

            return result;
        }

        result.push(new StraightRoadPrimitive({
            transient: false,
            direction: 'forward',
            start: { x: segment.startX, z: segment.startZ },
            end: { x: segment.endX, z: segment.endZ },
            roadType: road.forward,
            cuts: cuts?.forwardCuts,
        }));

        if (road.backward) {
            result.push(new StraightRoadPrimitive({
                transient: false,
                direction: 'backward',
                start: { x: segment.endX, z: segment.endZ },
                end: { x: segment.startX, z: segment.startZ },
                roadType: road.backward,
                cuts: cuts?.backwardCuts,
            }));
        }

        return result;
    }

    compileTransientJoinArc(params: {
        id: string;
        direction: 'forward' | 'backward';
        start: IPointXZ;
        mid: IPointXZ;
        end: IPointXZ;
        roadType: IRoadType;
        cuts?: IRoadCuts;
    }): RoadPrimitive {
        return new CurvedRoadPrimitive({
            transient: true,
            direction: params.direction,
            start: params.start,
            mid: params.mid,
            end: params.end,
            roadType: params.roadType,
            cuts: params.cuts,
        });
    }
}
