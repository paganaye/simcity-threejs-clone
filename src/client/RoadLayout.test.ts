import { describe, expect, it } from 'vitest';
import { TwoWayRoadBuilder } from './TwoWayRoadBuilder';
import { buildCompositeRoadCrossSection, buildCrossJunctionGeometry, buildRoadCrossSection, IRoadLayoutMetrics } from './RoadLayout';
import type { IRoad, IRoadOptions } from './roads/IRoad';

const metrics: IRoadLayoutMetrics = {
    oldRoadColor: 'old-road',
    newRoadColor: 'new-road',
    sidewalkColor: 'sidewalk',
    grassColor: 'grass',
    yellowLineColor: 'yellow',
    whiteLineColor: 'white',
    yellowLineWidthM: 0.15,
    emergencyLaneWidthM: 2,
    parallelParkingWidthM: 2.4,
    perpendicularParkingWidthM: 5,
    smallSidewalkM: 1,
    largeSidewalkM: 2,
    grassWidthM: 1,
    narrowLaneWidthM: 3,
    normalLaneWidthM: 3.5,
    wideLaneWidthM: 4.25,
};

const oneWay: IRoadOptions = {
    roadColor: 'old',
    lanes: 2,
    rightKerb: 'line',
    rightSidewalk: 'small',
    laneWidth: 'normal',
    leftKerb: 'none',
    leftSidewalk: 'grass',
};

describe('RoadLayout', () => {
    it('keeps right-side grass on the outside for the backward carriageway', () => {
        const road: IRoad = {
            forward: {
                roadColor: 'old',
                lanes: 1,
                leftKerb: 'none',
                leftSidewalk: 'none',
                rightKerb: 'none',
                rightSidewalk: 'grass',
                laneWidth: 'normal',
            },
            backward: {
                roadColor: 'old',
                lanes: 1,
                leftKerb: 'none',
                leftSidewalk: 'none',
                rightKerb: 'none',
                rightSidewalk: 'grass',
                laneWidth: 'normal',
            },
            gapSize: 2,
        };

        const crossSection = buildCompositeRoadCrossSection(road, TwoWayRoadBuilder.getLayoutMetrics());

        expect(crossSection.bands.map((band) => band.kind)).toEqual([
            'grass',
            'asphalt',
            'gap',
            'asphalt',
            'grass',
        ]);
    });

    it('builds a cross section with carriageway bounds', () => {
        const section = buildRoadCrossSection(oneWay, metrics);

        expect(section.totalWidthM).toBeCloseTo(9.45);
        expect(section.carriagewayStartM).toBeCloseTo(1);
        expect(section.carriagewayEndM).toBeCloseTo(8.45);
        expect(section.carriagewayWidthM).toBeCloseTo(7.45);
    });

    it('builds a composite two-way section with a median gap', () => {
        const road: IRoad = {
            forward: oneWay,
            backward: {
                ...oneWay,
                leftSidewalk: 'none',
                rightSidewalk: 'none',
            },
            gapSize: 2,
        };

        const section = buildCompositeRoadCrossSection(road, metrics);

        expect(section.totalWidthM).toBeCloseTo(18.9);
        expect(section.carriagewayStartM).toBeCloseTo(0);
        expect(section.carriagewayEndM).toBeCloseTo(17.9);
    });

    it('builds a cross junction footprint from two roads', () => {
        const mainRoad: IRoad = { forward: oneWay, gapSize: 0 };
        const crossingRoad: IRoad = {
            forward: { ...oneWay, lanes: 1, leftSidewalk: 'none', rightSidewalk: 'small' },
            backward: { ...oneWay, lanes: 1, leftSidewalk: 'none', rightSidewalk: 'small' },
            gapSize: 1,
        };

        const geometry = buildCrossJunctionGeometry(mainRoad, crossingRoad, metrics, { approachLengthM: 6 });

        expect(geometry.intersectionWidthM).toBeCloseTo(8.6);
        expect(geometry.intersectionHeightM).toBeCloseTo(7.45);
        expect(geometry.textureWidthM).toBeCloseTo(20.6);
        expect(geometry.textureHeightM).toBeCloseTo(19.45);
    });
});