import * as THREE from 'three';
import type { IRoadType } from './IRoad';
import { StraightRoadPrimitive } from './StraightRoadPrimitive';
import type { PrimitiveEndPoint, PrimitiveEntry, PrimitiveExit } from './RoadPrimitive';
import type { IExtremityCut } from './RoadCuts';
import { getBands } from './RoadLayout';
import { intersectRayWithLine, normalize2D, type IPoint2D } from '../../sim/Geometry';
import { JoiningRoadsParams } from './RoadJoin';

const JOIN_EPS = 1e-6;
const TIGHT_SEGMENT_EPS = 0.05;
const TIGHT_MAX_CUT_RATIO = 0.48;
const TIGHT_NOSE_DEPTH_RATIO = 0.7;
const TIGHT_NOSE_DEPTH_WIDTH_RATIO = 0.9;
const TIGHT_TRIM_REDUCTION = 0.84;
const TIGHT_MIN_CENTER_SEGMENT_WIDTH_RATIO = 0.55;

type TightJoinGeometry = {
    kind: 'tight';
    start: IPoint2D;
    end: IPoint2D;
    firstPoint: IPoint2D;
    secondPoint: IPoint2D;
    mid: { x: number; y: number; z: number };
    previousRoadExitTrim: number;
    nextRoadEntryTrim: number;
    firstExitCut: IExtremityCut;
    secondEntryCut: IExtremityCut;
    secondExitCut: IExtremityCut;
    thirdEntryCut: IExtremityCut;
};

export class TightJoiningRoad extends StraightRoadPrimitive {
    private static directionAwayFromSide(endpoint: PrimitiveEndPoint): IPoint2D | null {
        const primitive = endpoint.primitive;
        const dx = primitive.exit.x - primitive.entry.x;
        const dz = primitive.exit.z - primitive.entry.z;
        const length = Math.hypot(dx, dz);
        if (!Number.isFinite(length) || length <= JOIN_EPS) return null;
        return endpoint.side === 'entry'
            ? { x: dx / length, z: dz / length }
            : { x: -dx / length, z: -dz / length };
    }

    static computeTightJoinGeometry(
        joinArgs: JoiningRoadsParams
    ): TightJoinGeometry | null {
        const d1 = this.directionAwayFromSide(joinArgs.nextRoadEntry);
        const d2 = this.directionAwayFromSide(joinArgs.previousRoadExit);
        if (!d1 || !d2) return null;

        const p1 = joinArgs.nextRoadEntry;
        const p2 = joinArgs.previousRoadExit;
        const det = d1.x * d2.z - d1.z * d2.x;
        if (Math.abs(det) <= JOIN_EPS) return null;

        const t = ((p2.x - p1.x) * d2.z - (p2.z - p1.z) * d2.x) / det;
        const node = { x: p1.x + d1.x * t, z: p1.z + d1.z * t };

        const firstOpposite = joinArgs.nextRoadEntry.primitive.exit;
        const secondOpposite = joinArgs.previousRoadExit.primitive.entry;
        const firstSegmentLength = joinArgs.nextRoadEntry.primitive.segment?.length ?? 20;
        const secondSegmentLength = joinArgs.previousRoadExit.primitive.segment?.length ?? 20;
        const firstMaxTrim = (firstOpposite.x - node.x) * d1.x + (firstOpposite.z - node.z) * d1.z;
        const secondMaxTrim = (secondOpposite.x - node.x) * d2.x + (secondOpposite.z - node.z) * d2.z;
        const maxTrim = Math.max(
            0,
            Math.min(firstMaxTrim, secondMaxTrim, firstSegmentLength * 0.5, secondSegmentLength * 0.5) - 0.001,
        );
        if (!Number.isFinite(maxTrim) || maxTrim <= TIGHT_SEGMENT_EPS) return null;

        const dot = THREE.MathUtils.clamp(d1.x * d2.x + d1.z * d2.z, -1, 1);
        const phi = Math.acos(dot);
        if (!Number.isFinite(phi) || phi < 0.02 || phi > Math.PI - 0.02) return null;

        const tanHalf = Math.tan(phi / 2);
        if (!Number.isFinite(tanHalf) || tanHalf <= JOIN_EPS) return null;

        const desiredTrim = joinArgs.radius / tanHalf;
        if (desiredTrim <= maxTrim + JOIN_EPS) return null;

        const bisectorX = d1.x + d2.x;
        const bisectorZ = d1.z + d2.z;
        const bisectorLength = Math.hypot(bisectorX, bisectorZ);
        if (!Number.isFinite(bisectorLength) || bisectorLength <= JOIN_EPS) return null;

        const bisector = { x: bisectorX / bisectorLength, z: bisectorZ / bisectorLength };
        const bisectorPerp = { x: -bisector.z, z: bisector.x };
        const widthM = getBands(joinArgs.roadType).totalWidthM;
        const noseDepth = Math.max(
            0.25,
            Math.min(
                maxTrim * TIGHT_NOSE_DEPTH_RATIO,
                widthM * TIGHT_NOSE_DEPTH_WIDTH_RATIO,
            ),
        );
        const seamPoint = {
            x: node.x + bisector.x * noseDepth,
            z: node.z + bisector.z * noseDepth,
        };

        const first = intersectRayWithLine(node, d2, seamPoint, bisectorPerp, JOIN_EPS);
        const second = intersectRayWithLine(node, d1, seamPoint, bisectorPerp, JOIN_EPS);
        if (!first || !second) return null;

        if (first.t <= TIGHT_SEGMENT_EPS || second.t <= TIGHT_SEGMENT_EPS) return null;
        if (first.t >= maxTrim - TIGHT_SEGMENT_EPS || second.t >= maxTrim - TIGHT_SEGMENT_EPS) return null;

        const minSegmentMargin = Math.max(TIGHT_SEGMENT_EPS, widthM * 0.08);
        const minTrim = Math.max(first.t, second.t) + minSegmentMargin;
        if (minTrim >= maxTrim - JOIN_EPS) return null;
        const targetTrim = maxTrim * TIGHT_TRIM_REDUCTION;
        const usedTrim = THREE.MathUtils.clamp(targetTrim, minTrim, maxTrim);

        const start = { x: node.x + d2.x * usedTrim, z: node.z + d2.z * usedTrim };
        const end = { x: node.x + d1.x * usedTrim, z: node.z + d1.z * usedTrim };

        const seg1Length = Math.hypot(first.point.x - start.x, first.point.z - start.z);
        const seg2Length = Math.hypot(second.point.x - first.point.x, second.point.z - first.point.z);
        const seg3Length = Math.hypot(end.x - second.point.x, end.z - second.point.z);
        if (seg1Length <= TIGHT_SEGMENT_EPS || seg2Length <= TIGHT_SEGMENT_EPS || seg3Length <= TIGHT_SEGMENT_EPS) return null;
        if (seg2Length < widthM * TIGHT_MIN_CENTER_SEGMENT_WIDTH_RATIO) return null;

        const u1 = normalize2D({ x: first.point.x - start.x, z: first.point.z - start.z }, JOIN_EPS);
        const u2 = normalize2D({ x: second.point.x - first.point.x, z: second.point.z - first.point.z }, JOIN_EPS);
        const u3 = normalize2D({ x: end.x - second.point.x, z: end.z - second.point.z }, JOIN_EPS);
        if (!u1 || !u2 || !u3) return null;

        const seamNormal1 = normalize2D({ x: -u1.x + u2.x, z: -u1.z + u2.z }, JOIN_EPS) ?? { x: -u1.z, z: u1.x };
        const seamNormal2 = normalize2D({ x: -u2.x + u3.x, z: -u2.z + u3.z }, JOIN_EPS) ?? { x: -u3.z, z: u3.x };

        const firstExitCut = this.computeMiterCut(u1, seamNormal1, 'exit', seg1Length, joinArgs.roadType);
        const secondEntryCut = this.computeMiterCut(u2, seamNormal1, 'entry', seg2Length, joinArgs.roadType);
        const secondExitCut = this.computeMiterCut(u2, seamNormal2, 'exit', seg2Length, joinArgs.roadType);
        const thirdEntryCut = this.computeMiterCut(u3, seamNormal2, 'entry', seg3Length, joinArgs.roadType);

        const mid = {
            x: seamPoint.x,
            y: ((p1.y ?? 0) + (p2.y ?? 0)) * 0.5,
            z: seamPoint.z,
        };

        return {
            kind: 'tight',
            start,
            end,
            firstPoint: first.point,
            secondPoint: second.point,
            mid,
            previousRoadExitTrim: usedTrim,
            nextRoadEntryTrim: usedTrim,
            firstExitCut,
            secondEntryCut,
            secondExitCut,
            thirdEntryCut,
        };
    }

    private static computeMiterCut(
        segmentDirection: IPoint2D,
        seamNormal: IPoint2D,
        side: 'entry' | 'exit',
        length: number,
        roadType: IRoadType,
    ): IExtremityCut {
        const bands = getBands(roadType);
        const width = bands.totalWidthM;
        const leftOuter = width * 0.5;
        const roadLeft = leftOuter - bands.carriagewayStartM;
        const roadRight = leftOuter - bands.carriagewayEndM;
        const middle = (roadLeft + roadRight) * 0.5;
        const rightOuter = -leftOuter;
        const lateral = [leftOuter, roadLeft, middle, roadRight, rightOuter];

        const u = normalize2D(segmentDirection, JOIN_EPS);
        const m = normalize2D(seamNormal, JOIN_EPS);
        if (!u || !m) {
            return { left: 0, roadLeft: 0, middle: 0, roadRight: 0, right: 0 };
        }

        const uDotM = u.x * m.x + u.z * m.z;
        if (Math.abs(uDotM) <= JOIN_EPS) {
            return { left: 0, roadLeft: 0, middle: 0, roadRight: 0, right: 0 };
        }

        const n = { x: -u.z, z: u.x };
        const nDotM = n.x * m.x + n.z * m.z;
        const slope = nDotM / uDotM;
        const raw = lateral.map((z) => {
            const value = side === 'entry' ? -slope * z : slope * z;
            return Number.isFinite(value) ? value : 0;
        });

        let minValue = raw[0];
        let maxValue = raw[0];
        for (let i = 1; i < raw.length; i++) {
            minValue = Math.min(minValue, raw[i]);
            maxValue = Math.max(maxValue, raw[i]);
        }

        const offset = minValue < 0 ? -minValue : 0;
        const shifted = raw.map((value) => value + offset);
        const shiftedMax = maxValue + offset;
        const maxAllowed = Math.max(0, length * TIGHT_MAX_CUT_RATIO);
        const scale = shiftedMax > JOIN_EPS && shiftedMax > maxAllowed ? maxAllowed / shiftedMax : 1;
        const values = shifted.map((value) => Math.max(0, value * scale));

        return {
            left: values[0],
            roadLeft: values[1],
            middle: values[2],
            roadRight: values[3],
            right: values[4],
        };
    }

    private static applySharpNeighborCuts(
        previousRoadExit: PrimitiveExit,
        nextRoadEntry: PrimitiveEntry,
    ): void {
        const nextRoadCuts = nextRoadEntry.primitive.cuts || (nextRoadEntry.primitive.cuts = {});
        nextRoadCuts.entryCut = {
            left: 7,
            roadLeft: 4,
            middle: 2.5,
            roadRight: 1,
            right: 0,
        };
        const previousRoadCuts = previousRoadExit.primitive.cuts || (previousRoadExit.primitive.cuts = {});
        previousRoadCuts.exitCut = {
            left: 7,
            roadLeft: 4,
            middle: 2.5,
            roadRight: 1,
            right: 0,
        };
        nextRoadEntry.primitive.recreateMesh();
        previousRoadExit.primitive.recreateMesh();
    }

    static create(
        joinArgs: JoiningRoadsParams,
    ): TightJoiningRoad | null {

        const geometry = TightJoiningRoad.computeTightJoinGeometry(joinArgs);
        if (!geometry) return null;

        this.applySharpNeighborCuts(joinArgs.previousRoadExit, joinArgs.nextRoadEntry);

        return null; // temporarily
        // return new TightJoiningRoad(joinArgs, geometry);
    }

    constructor(
        params: JoiningRoadsParams,
        geometry: TightJoinGeometry) {
        super({
            parent: params.parent,
            segment: undefined,
            transient: true,
            start: geometry.start,
            end: geometry.end,
            roadType: params.roadType,
            cuts: {
                entryCut: geometry.secondEntryCut,
                exitCut: geometry.secondExitCut,
            },
        });
    }

}
