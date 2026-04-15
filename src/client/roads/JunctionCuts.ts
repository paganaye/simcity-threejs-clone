import { getBands } from './RoadLayout';
import type { IExtremityCut, IRoadCuts } from './RoadCuts';
import { IRoadType } from './IRoad';
import { IPoint2D, IVector2D } from '../../sim/Geometry';

export type IStraightRoadCutDef = {
    start: { x: number; y: number; z: number; angle: number };
    length: number;
    style: IRoadType;
};

type IBoundaryKey = 'leftOuter' | 'roadLeft' | 'roadRight' | 'rightOuter';
type IMajorBoundaryKey = 'outer' | 'road';
type ILine2 = { origin: IVector2D; direction: IVector2D };
type IBoundaryLines = Record<IBoundaryKey, ILine2>;
type IMajorBoundaryLines = Record<IMajorBoundaryKey, ILine2>;
export type IMajorBoundarySelection = { side: 'left' | 'right'; lines: IMajorBoundaryLines };
type IIntersectionResult = Record<IMajorBoundaryKey, Record<IBoundaryKey, number | null>>;

export function signedLateralDistance(road: IStraightRoadCutDef, point: IPoint2D): number {
    const normal = { x: Math.sin(road.start.angle), z: Math.cos(road.start.angle) };
    const dx = point.x - road.start.x;
    const dz = point.z - road.start.z;
    return dx * normal.x + dz * normal.z;
}

function cross2(a: IVector2D, b: IVector2D): number {
    return a.x * b.z - a.z * b.x;
}

function getRoadAxis(road: IStraightRoadCutDef): IVector2D {
    return { x: Math.cos(road.start.angle), z: -Math.sin(road.start.angle) };
}

function getRoadNormal(road: IStraightRoadCutDef): IVector2D {
    return { x: Math.sin(road.start.angle), z: Math.cos(road.start.angle) };
}

function getRoadOffsets(road: IStraightRoadCutDef): Record<IBoundaryKey, number> {
    const bands = getBands(road.style);
    const widthM = bands.totalWidthM;
    const carriagewayCenter = (bands.carriagewayStartM + bands.carriagewayEndM) / 2;
    const halfOffsetM = carriagewayCenter - widthM / 2;

    const leftOuter = halfOffsetM + widthM / 2;
    const roadLeft = halfOffsetM + (widthM / 2 - bands.carriagewayStartM);
    const roadRight = halfOffsetM + (widthM / 2 - bands.carriagewayEndM);
    const rightOuter = halfOffsetM - widthM / 2;

    return { leftOuter, roadLeft, roadRight, rightOuter };
}

export function getBoundaryLines(road: IStraightRoadCutDef): IBoundaryLines {
    const axis = getRoadAxis(road);
    const normal = getRoadNormal(road);
    const offsets = getRoadOffsets(road);

    const createLine = (offset: number): ILine2 => ({
        origin: {
            x: road.start.x + normal.x * offset,
            z: road.start.z + normal.z * offset,
        },
        direction: axis,
    });

    return {
        leftOuter: createLine(offsets.leftOuter),
        roadLeft: createLine(offsets.roadLeft),
        roadRight: createLine(offsets.roadRight),
        rightOuter: createLine(offsets.rightOuter),
    };
}

export function getMajorBoundarySelection(mainRoad: IStraightRoadCutDef, minorRoad: IStraightRoadCutDef): IMajorBoundarySelection {
    const lines = getBoundaryLines(mainRoad);
    const leftCandidate: IMajorBoundaryLines = { outer: lines.leftOuter, road: lines.roadLeft };
    const rightCandidate: IMajorBoundaryLines = { outer: lines.rightOuter, road: lines.roadRight };
    const minorLines = getBoundaryLines(minorRoad);

    const evaluateCandidate = (candidate: IMajorBoundaryLines): number => {
        const values: number[] = [];
        const keys: IBoundaryKey[] = ['leftOuter', 'roadLeft', 'roadRight', 'rightOuter'];
        for (const key of keys) {
            const intersection = intersectInfiniteLines(
                minorLines[key].origin,
                minorLines[key].direction,
                candidate.outer.origin,
                candidate.outer.direction,
            );
            if (!intersection) continue;
            if (!Number.isFinite(intersection.aT) || intersection.aT < 0) continue;
            values.push(intersection.aT);
        }

        if (!values.length) return Number.POSITIVE_INFINITY;
        return Math.min(...values);
    };

    const leftScore = evaluateCandidate(leftCandidate);
    const rightScore = evaluateCandidate(rightCandidate);

    if (Number.isFinite(leftScore) || Number.isFinite(rightScore)) {
        return leftScore <= rightScore
            ? { side: 'left', lines: leftCandidate }
            : { side: 'right', lines: rightCandidate };
    }

    const isMinorOnMainLeft = signedLateralDistance(mainRoad, { x: minorRoad.start.x, z: minorRoad.start.z }) < 0;
    return isMinorOnMainLeft
        ? { side: 'left', lines: leftCandidate }
        : { side: 'right', lines: rightCandidate };
}

function intersectInfiniteLines(
    aOrigin: IVector2D,
    aDirection: IVector2D,
    bOrigin: IVector2D,
    bDirection: IVector2D,
): { aT: number; bT: number } | null {
    const denominator = cross2(aDirection, bDirection);
    if (Math.abs(denominator) < 1e-6) return null;

    const delta = {
        x: bOrigin.x - aOrigin.x,
        z: bOrigin.z - aOrigin.z,
    };

    return {
        aT: cross2(delta, bDirection) / denominator,
        bT: cross2(delta, aDirection) / denominator,
    };
}

export function getMinorMajorIntersections(
    mainRoad: IStraightRoadCutDef,
    minorRoad: IStraightRoadCutDef,
    clampToMainSegment = true,
): IIntersectionResult {
    const majorSelection = getMajorBoundarySelection(mainRoad, minorRoad);
    const majorLines = majorSelection.lines;
    const minorLines = getBoundaryLines(minorRoad);
    const result: IIntersectionResult = {
        outer: { leftOuter: null, roadLeft: null, roadRight: null, rightOuter: null },
        road: { leftOuter: null, roadLeft: null, roadRight: null, rightOuter: null },
    };
    const epsilon = 1e-4;

    const majorKeys: IMajorBoundaryKey[] = ['outer', 'road'];
    const minorKeys: IBoundaryKey[] = ['leftOuter', 'roadLeft', 'roadRight', 'rightOuter'];

    for (const majorKey of majorKeys) {
        for (const minorKey of minorKeys) {
            const intersection = intersectInfiniteLines(
                minorLines[minorKey].origin,
                minorLines[minorKey].direction,
                majorLines[majorKey].origin,
                majorLines[majorKey].direction,
            );
            if (!intersection) {
                result[majorKey][minorKey] = null;
                continue;
            }

            if (clampToMainSegment && (intersection.bT < -epsilon || intersection.bT > mainRoad.length + epsilon)) {
                result[majorKey][minorKey] = null;
                continue;
            }

            result[majorKey][minorKey] = intersection.aT;
        }
    }

    return result;
}

function clampCut(value: number, length: number): number {
    return Math.max(0, Math.min(length, value));
}

export function computeMajorRoadSideCut(mainRoad: IStraightRoadCutDef, minorRoad: IStraightRoadCutDef, roadCuts: IRoadCuts): void {
    const majorSelection = getMajorBoundarySelection(mainRoad, minorRoad);
    const majorLines = majorSelection.lines;
    const minorLines = getBoundaryLines(minorRoad);
    const epsilon = 1e-4;

    const getMainDistance = (majorKey: IMajorBoundaryKey, minorKey: IBoundaryKey): number | null => {
        const intersection = intersectInfiniteLines(
            minorLines[minorKey].origin,
            minorLines[minorKey].direction,
            majorLines[majorKey].origin,
            majorLines[majorKey].direction,
        );
        if (!intersection) return null;

        if (intersection.aT < -epsilon || intersection.aT > minorRoad.length + epsilon) return null;
        if (intersection.bT < -epsilon || intersection.bT > mainRoad.length + epsilon) return null;
        if (!Number.isFinite(intersection.bT)) return null;

        return clampCut(intersection.bT, mainRoad.length);
    };

    const outerCandidates = [
        getMainDistance('outer', 'leftOuter'),
        getMainDistance('outer', 'rightOuter'),
    ].filter((value): value is number => value !== null);
    const roadCandidates = [
        getMainDistance('road', 'roadLeft'),
        getMainDistance('road', 'roadRight'),
    ].filter((value): value is number => value !== null);

    if (outerCandidates.length < 2 || roadCandidates.length < 2) {
        return
    }

    const from = Math.min(...outerCandidates);
    const to = Math.max(...outerCandidates);
    const rawRoadFrom = Math.min(...roadCandidates);
    const rawRoadTo = Math.max(...roadCandidates);

    const roadFrom = Math.max(from, Math.min(rawRoadFrom, to));
    const roadTo = Math.max(roadFrom, Math.min(rawRoadTo, to));

    if (to - from < 1e-3) return;
    if (roadTo - roadFrom < 1e-3) return;

    const segment = { from, roadFrom, roadTo, to };
    if (majorSelection.side === 'left')
        roadCuts.rightCuts = roadCuts.rightCuts ? [...roadCuts.rightCuts, segment] : [segment];
    else
        roadCuts.leftCuts = roadCuts.leftCuts ? [...roadCuts.leftCuts, segment] : [segment];
}

export function computeMinorRoadLengthToMainEdge(mainRoad: IStraightRoadCutDef, minorRoad: IStraightRoadCutDef): number {
    const intersections = getMinorMajorIntersections(mainRoad, minorRoad, false);
    const majorKeys: IMajorBoundaryKey[] = ['outer', 'road'];
    const minorKeys: IBoundaryKey[] = ['leftOuter', 'roadLeft', 'roadRight', 'rightOuter'];
    const candidates = majorKeys
        .flatMap((maj) => minorKeys.map((min) => intersections[maj][min]))
        .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);

    if (candidates.length === 0) return minorRoad.length;

    return Math.max(0, Math.max(...candidates) + 0.02);
}

export function computeMinorRoadEndCut(mainRoad: IStraightRoadCutDef, minorRoad: IStraightRoadCutDef): IExtremityCut {
    const intersections = getMinorMajorIntersections(mainRoad, minorRoad);
    const localLength = minorRoad.length;
    const epsilon = 1e-4;

    const toEndCut = (intersectionDistance: number | null): number => {
        if (intersectionDistance === null || !Number.isFinite(intersectionDistance)) return 0;
        if (intersectionDistance < -epsilon || intersectionDistance > localLength + epsilon) return 0;
        return clampCut(localLength - intersectionDistance, localLength);
    };

    // Renderer orientation means geometry-left maps to world-right for this projection.
    let left = toEndCut(intersections.outer.rightOuter);
    let roadLeft = toEndCut(intersections.road.roadRight);
    let roadRight = toEndCut(intersections.road.roadLeft);
    let right = toEndCut(intersections.outer.leftOuter);
    const middle = clampCut((roadLeft + roadRight) * 0.5, localLength);

    left = Math.max(left, roadLeft);
    right = Math.max(right, roadRight);

    return { left: left, roadLeft: roadLeft, middle: middle, roadRight: roadRight, right: right };
}
