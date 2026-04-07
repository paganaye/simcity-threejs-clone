import { roadTypes, RoadType } from '../RoadBuilder';
import type { IRoad, IRoadOptions } from './IRoad';

export function roadTypeToIRoad(roadType: RoadType): IRoad {
    const options = roadTypes[roadType];
    const baseOptions: IRoadOptions = {
        roadColor: options.roadColor,
        lanes: options.lanes,
        shoulder: options.shoulder,
        sidewalk: options.sidewalk,
    };

    // Temporary adapter while editor still exposes old road presets.
    return {
        type: 'TwoWayRoad',
        forwardWay: baseOptions,
        otherWay: baseOptions,
        dividing: options.dividing,
    };
}
