import { describe, it } from 'vitest';
// import type { IRoadOptions } from './roads/IRoad';

// const oneWay: IRoadOptions = {
//     roadColor: 'old',
//     lanes: 2,
//     rightKerb: 'line',
//     rightSidewalk: 'small',
//     laneWidth: 'normal',
//     leftKerb: 'none',
//     leftSidewalk: 'grass',
// };

describe('RoadLayout', () => {
    it('keeps right-side grass on the outside for the backward carriageway', () => {
        // const road: IRoad = {
        //     forward: {
        //         roadColor: 'old',
        //         lanes: 1,
        //         leftKerb: 'none',
        //         leftSidewalk: 'none',
        //         rightKerb: 'none',
        //         rightSidewalk: 'grass',
        //         laneWidth: 'normal',
        //     },
        //     backward: {
        //         roadColor: 'old',
        //         lanes: 1,
        //         leftKerb: 'none',
        //         leftSidewalk: 'none',
        //         rightKerb: 'none',
        //         rightSidewalk: 'grass',
        //         laneWidth: 'normal',
        //     },
        //     gapSize: 2,
        // };

        //const crossSection = buildCompositeRoadCrossSection(road);

        // expect(crossSection.bands.map((band) => band.type)).toEqual([
        //     'grass',
        //     'asphalt',
        //     'gap',
        //     'asphalt',
        //     'grass',
        // ]);
    });

    it('builds a cross section with carriageway bounds', () => {
        // const section = getRoadBands(oneWay);

        // expect(section.totalWidthM).toBeCloseTo(9.45);
        // expect(section.carriagewayStartM).toBeCloseTo(1);
        // expect(section.carriagewayEndM).toBeCloseTo(8.45);
        // expect(section.carriagewayWidthM).toBeCloseTo(7.45);
    });

    it('builds a composite two-way section with a median gap', () => {
        // const road: IRoad = {
        //     forward: oneWay,
        //     backward: {
        //         ...oneWay,
        //         leftSidewalk: 'none',
        //         rightSidewalk: 'none',
        //     },
        //     gapSize: 2,
        // };

        // const section = buildCompositeRoadCrossSection(road);
        // expect(section.totalWidthM).toBeCloseTo(18.9);
        // expect(section.carriagewayStartM).toBeCloseTo(0);
        // expect(section.carriagewayEndM).toBeCloseTo(17.9);
    });

    it('builds a cross junction footprint from two roads', () => {
        // const mainRoad: IRoad = { forward: oneWay, gapSize: 0 };
        // const crossingRoad: IRoad = {
        //     forward: { ...oneWay, lanes: 1, leftSidewalk: 'none', rightSidewalk: 'small' },
        //     backward: { ...oneWay, lanes: 1, leftSidewalk: 'none', rightSidewalk: 'small' },
        //     gapSize: 1,
        // };

        //const geometry = buildCrossJunctionGeometry(mainRoad, crossingRoad);

        // expect(geometry.intersectionWidthM).toBeCloseTo(8.6);
        // expect(geometry.intersectionHeightM).toBeCloseTo(7.45);
        // expect(geometry.textureWidthM).toBeCloseTo(20.6);
        // expect(geometry.textureHeightM).toBeCloseTo(19.45);
    });
});