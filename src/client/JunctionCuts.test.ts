import { describe, expect, it } from 'vitest';
import { computeMajorRoadSideCut, computeMinorRoadEndCut, computeMinorRoadLengthToMainEdge, IStraightRoadCutDef } from './JunctionCuts';
import type { IRoadType } from './roads/IRoad';
import type { IRoadCuts } from './RoadBuilder';

const roadType: IRoadType = {
    roadColor: 'old',
    lanes: 3,
    rightKerb: 'line',
    rightSidewalk: 'grass',
    laneWidth: 'normal',
    leftKerb: 'line',
    leftSidewalk: 'small',
};

function assertMonotonicCuts(cuts: IRoadCuts, maxLength: number): void {
    const segments = [...(cuts.leftCuts ?? []), ...(cuts.rightCuts ?? [])];
    for (const segment of segments) {
        expect(segment.from).toBeGreaterThanOrEqual(0);
        expect(segment.roadFrom).toBeGreaterThanOrEqual(segment.from);
        expect(segment.roadTo).toBeGreaterThanOrEqual(segment.roadFrom);
        expect(segment.to).toBeGreaterThanOrEqual(segment.roadTo);
        expect(segment.to).toBeLessThanOrEqual(maxLength + 1e-3);
    }
}

describe('JunctionCuts', () => {
    it('computes stable cuts for several minor-road angles', () => {
        const mainRoad: IStraightRoadCutDef = {
            start: { x: 0, y: 0, z: 10, angle: 0 },
            length: 39,
            style: roadType,
        };

        const minorBases: IStraightRoadCutDef[] = [
            { start: { x: 10, y: 0, z: 30, angle: Math.PI / 4 }, length: 23, style: roadType },
            { start: { x: 10, y: 0, z: 0, angle: -Math.PI / 4 }, length: 23, style: roadType },
            { start: { x: 25, y: 0, z: 26, angle: (3 * Math.PI) / 4 }, length: 23, style: roadType },
            { start: { x: 25, y: 0, z: -6, angle: -(3 * Math.PI) / 4 }, length: 23, style: roadType },
        ];

        const mainCuts: IRoadCuts = {};

        for (const minorBase of minorBases) {
            const minorRoad: IStraightRoadCutDef = {
                ...minorBase,
                length: computeMinorRoadLengthToMainEdge(mainRoad, minorBase),
            };

            const endCut = computeMinorRoadEndCut(mainRoad, minorRoad);
            const hasEndCut = endCut.left > 1e-3 || endCut.roadLeft > 1e-3 || endCut.roadRight > 1e-3 || endCut.right > 1e-3;
            expect(hasEndCut).toBe(true);

            computeMajorRoadSideCut(mainRoad, minorRoad, mainCuts);
        }

        const totalMajorSegments = (mainCuts.leftCuts?.length ?? 0) + (mainCuts.rightCuts?.length ?? 0);
        expect(totalMajorSegments).toBeGreaterThan(0);
        assertMonotonicCuts(mainCuts, mainRoad.length);
    });
});
