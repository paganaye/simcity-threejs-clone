import * as THREE from 'three';
import type { IRoadType } from './IRoad';
import type { PrimitiveEndPoint, PrimitiveEntry, PrimitiveExit } from './RoadPrimitive';
import { getBands } from './RoadLayout';
import type { IExtremityCut } from './RoadCuts';
import type { IPoint2D } from '../../sim/Geometry';
import { CurvedJoiningRoad } from './CurvedJoiningRoad';
import { TightJoiningRoad } from './TightJoiningRoad';
import { JoiningRoadPrimitives } from './JoiningRoadPrimitives';

const DEBUG_JOINING_ROAD = true;
const JOIN_EPS = 1e-6;
const TIGHT_SEGMENT_EPS = 0.05;
const TIGHT_MAX_CUT_RATIO = 0.48;
const TIGHT_NOSE_DEPTH_RATIO = 0.7;
const TIGHT_NOSE_DEPTH_WIDTH_RATIO = 0.9;
const TIGHT_TRIM_REDUCTION = 0.84;
const TIGHT_MIN_CENTER_SEGMENT_WIDTH_RATIO = 0.55;

export type JoiningPrimitiveOptions = {
    radius?: number;
};

export type ArcJoinGeometry = {
    kind: 'arc';
    start: IPoint2D;
    end: IPoint2D;
    center: IPoint2D;
    mid: { x: number; y: number; z: number };
    actualRadius: number;
    previousRoadExitTrim: number;
    nextRoadEntryTrim: number;
};

export type TightJoinGeometry = {
    kind: 'tight';
    start: IPoint2D;
    end: IPoint2D;
    mid: { x: number; y: number; z: number };
    previousRoadExitTrim: number;
    nextRoadEntryTrim: number;
    firstExitCut: IExtremityCut;
    secondEntryCut: IExtremityCut;
    secondExitCut: IExtremityCut;
    thirdEntryCut: IExtremityCut;
};

export class JoiningRoads {
    private static debug(message: string, data?: unknown): void {
        if (!DEBUG_JOINING_ROAD) return;
        if (data === undefined) {
            console.log(`[JoiningRoads] ${message}`);
            return;
        }
        console.log(`[JoiningRoads] ${message}`, data);
    }

    private static applyStraightNeighborCuts(
        previousRoadExit: PrimitiveExit,
        nextRoadEntry: PrimitiveEntry,
        previousRoadExitTrim: number,
        nextRoadEntryTrim: number,
    ): void {
        const nextRoadCuts = nextRoadEntry.primitive.cuts || (nextRoadEntry.primitive.cuts = {});
        nextRoadCuts.entryCut = {
            left: nextRoadEntryTrim,
            roadLeft: nextRoadEntryTrim,
            roadRight: nextRoadEntryTrim,
            right: nextRoadEntryTrim,
        };
        const previousRoadCuts = previousRoadExit.primitive.cuts || (previousRoadExit.primitive.cuts = {});
        previousRoadCuts.exitCut = {
            left: previousRoadExitTrim,
            roadLeft: previousRoadExitTrim,
            roadRight: previousRoadExitTrim,
            right: previousRoadExitTrim,
        };

        nextRoadEntry.primitive.recreateMesh();
        previousRoadExit.primitive.recreateMesh();
    }

    private static applySharpNeighborCuts(
        previousRoadExit: PrimitiveExit,
        nextRoadEntry: PrimitiveEntry,
    ): void {
        const nextRoadCuts = nextRoadEntry.primitive.cuts || (nextRoadEntry.primitive.cuts = {});
        nextRoadCuts.entryCut = {
            left: 7,
            roadLeft: 4,
            roadRight: 1,
            right: 0,
        };
        const previousRoadCuts = previousRoadExit.primitive.cuts || (previousRoadExit.primitive.cuts = {});
        previousRoadCuts.exitCut = {
            left: 7,
            roadLeft: 4,
            roadRight: 1,
            right: 0,
        };
        nextRoadEntry.primitive.recreateMesh();
        previousRoadExit.primitive.recreateMesh();
    }

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

    static computeCurvedJoinGeometry(
        previousRoadExit: PrimitiveExit,
        nextRoadEntry: PrimitiveEntry,
        requestedRadius: number,
    ): ArcJoinGeometry | null {
        const d1 = this.directionAwayFromSide(nextRoadEntry);
        const d2 = this.directionAwayFromSide(previousRoadExit);
        if (!d1 || !d2) return null;

        const p1 = nextRoadEntry;
        const p2 = previousRoadExit;
        const det = d1.x * d2.z - d1.z * d2.x;
        if (Math.abs(det) <= JOIN_EPS) return null;

        const t = ((p2.x - p1.x) * d2.z - (p2.z - p1.z) * d2.x) / det;
        const node = { x: p1.x + d1.x * t, z: p1.z + d1.z * t };
        const dot = THREE.MathUtils.clamp(d1.x * d2.x + d1.z * d2.z, -1, 1);
        const phi = Math.acos(dot);
        if (phi < 0.02 || phi > Math.PI - 0.02) return null;

        const tanHalf = Math.tan(phi / 2);
        if (!Number.isFinite(tanHalf) || tanHalf <= JOIN_EPS) return null;

        const firstOpposite = nextRoadEntry.primitive.exit;
        const secondOpposite = previousRoadExit.primitive.entry;
        const firstSegmentLength = nextRoadEntry.primitive.segment?.length ?? 20;
        const secondSegmentLength = previousRoadExit.primitive.segment?.length ?? 20;
        if (!Number.isFinite(firstSegmentLength) || !Number.isFinite(secondSegmentLength)) return null;

        const firstMaxTrim = (firstOpposite.x - node.x) * d1.x + (firstOpposite.z - node.z) * d1.z;
        const secondMaxTrim = (secondOpposite.x - node.x) * d2.x + (secondOpposite.z - node.z) * d2.z;
        const maxTrim = Math.max(
            0,
            Math.min(firstMaxTrim, secondMaxTrim, firstSegmentLength * 0.5, secondSegmentLength * 0.5) - 0.001,
        );
        const desiredTrim = requestedRadius / tanHalf;
        if (desiredTrim > maxTrim + JOIN_EPS) return null;

        const trim = THREE.MathUtils.clamp(desiredTrim, 0, maxTrim);
        if (!Number.isFinite(trim) || trim <= JOIN_EPS) return null;

        const actualRadius = trim * tanHalf;
        const end = { x: node.x + d1.x * trim, z: node.z + d1.z * trim };
        const start = { x: node.x + d2.x * trim, z: node.z + d2.z * trim };

        const turn = d1.x * d2.z - d1.z * d2.x;
        if (Math.abs(turn) <= JOIN_EPS) return null;

        const normalLeft = (d: IPoint2D) => ({ x: -d.z, z: d.x });
        const normalRight = (d: IPoint2D) => ({ x: d.z, z: -d.x });

        const n1 = turn > 0 ? normalLeft(d1) : normalRight(d1);
        const n2 = turn > 0 ? normalRight(d2) : normalLeft(d2);

        const centerFromEnd = {
            x: end.x + n1.x * actualRadius,
            z: end.z + n1.z * actualRadius,
        };
        const centerFromStart = {
            x: start.x + n2.x * actualRadius,
            z: start.z + n2.z * actualRadius,
        };

        const centerMismatch = Math.hypot(centerFromEnd.x - centerFromStart.x, centerFromEnd.z - centerFromStart.z);
        if (!Number.isFinite(centerMismatch) || centerMismatch > Math.max(0.05, actualRadius * 0.05)) return null;

        const center = {
            x: (centerFromEnd.x + centerFromStart.x) * 0.5,
            z: (centerFromEnd.z + centerFromStart.z) * 0.5,
        };
        const a1 = Math.atan2(end.z - center.z, end.x - center.x);
        const a2 = Math.atan2(start.z - center.z, start.x - center.x);
        let delta = a2 - a1;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta <= -Math.PI) delta += Math.PI * 2;
        if (Math.abs(delta) < JOIN_EPS) return null;

        const mid = {
            x: center.x + Math.cos(a1 + delta / 2) * actualRadius,
            y: ((p1.y ?? 0) + (p2.y ?? 0)) / 2,
            z: center.z + Math.sin(a1 + delta / 2) * actualRadius,
        };

        return {
            kind: 'arc',
            start,
            end,
            center,
            mid,
            actualRadius,
            nextRoadEntryTrim: trim,
            previousRoadExitTrim: trim,
        };
    }

    static computeTightJoinGeometry(
        previousRoadExit: PrimitiveExit,
        nextRoadEntry: PrimitiveEntry,
        roadType: IRoadType,
        requestedRadius: number,
    ): TightJoinGeometry | null {
        const d1 = this.directionAwayFromSide(nextRoadEntry);
        const d2 = this.directionAwayFromSide(previousRoadExit);
        if (!d1 || !d2) return null;

        const p1 = nextRoadEntry;
        const p2 = previousRoadExit;
        const det = d1.x * d2.z - d1.z * d2.x;
        if (Math.abs(det) <= JOIN_EPS) return null;

        const t = ((p2.x - p1.x) * d2.z - (p2.z - p1.z) * d2.x) / det;
        const node = { x: p1.x + d1.x * t, z: p1.z + d1.z * t };

        const firstOpposite = nextRoadEntry.primitive.exit;
        const secondOpposite = previousRoadExit.primitive.entry;
        const firstSegmentLength = nextRoadEntry.primitive.segment?.length ?? 20;
        const secondSegmentLength = previousRoadExit.primitive.segment?.length ?? 20;
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

        const desiredTrim = requestedRadius / tanHalf;
        if (desiredTrim <= maxTrim + JOIN_EPS) return null;

        const bisectorX = d1.x + d2.x;
        const bisectorZ = d1.z + d2.z;
        const bisectorLength = Math.hypot(bisectorX, bisectorZ);
        if (!Number.isFinite(bisectorLength) || bisectorLength <= JOIN_EPS) return null;

        const bisector = { x: bisectorX / bisectorLength, z: bisectorZ / bisectorLength };
        const bisectorPerp = { x: -bisector.z, z: bisector.x };
        const widthM = getBands(roadType).totalWidthM;
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

        const first = this.intersectRayWithLine(node, d2, seamPoint, bisectorPerp);
        const second = this.intersectRayWithLine(node, d1, seamPoint, bisectorPerp);
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

        const u1 = this.normalize2D({ x: first.point.x - start.x, z: first.point.z - start.z });
        const u2 = this.normalize2D({ x: second.point.x - first.point.x, z: second.point.z - first.point.z });
        const u3 = this.normalize2D({ x: end.x - second.point.x, z: end.z - second.point.z });
        if (!u1 || !u2 || !u3) return null;

        const seamNormal1 = this.normalize2D({ x: -u1.x + u2.x, z: -u1.z + u2.z }) ?? { x: -u1.z, z: u1.x };
        const seamNormal2 = this.normalize2D({ x: -u2.x + u3.x, z: -u2.z + u3.z }) ?? { x: -u3.z, z: u3.x };

        const firstExitCut = this.computeMiterCut(u1, seamNormal1, 'exit', seg1Length, roadType);
        const secondEntryCut = this.computeMiterCut(u2, seamNormal1, 'entry', seg2Length, roadType);
        const secondExitCut = this.computeMiterCut(u2, seamNormal2, 'exit', seg2Length, roadType);
        const thirdEntryCut = this.computeMiterCut(u3, seamNormal2, 'entry', seg3Length, roadType);

        const mid = {
            x: seamPoint.x,
            y: ((p1.y ?? 0) + (p2.y ?? 0)) * 0.5,
            z: seamPoint.z,
        };

        return {
            kind: 'tight',
            start,
            end,
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
        const rightOuter = -leftOuter;
        const lateral = [leftOuter, roadLeft, roadRight, rightOuter];

        const u = this.normalize2D(segmentDirection);
        const m = this.normalize2D(seamNormal);
        if (!u || !m) {
            return { left: 0, roadLeft: 0, roadRight: 0, right: 0 };
        }

        const uDotM = u.x * m.x + u.z * m.z;
        if (Math.abs(uDotM) <= JOIN_EPS) {
            return { left: 0, roadLeft: 0, roadRight: 0, right: 0 };
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
            roadRight: values[2],
            right: values[3],
        };
    }

    private static normalize2D(vector: IPoint2D): IPoint2D | null {
        const length = Math.hypot(vector.x, vector.z);
        if (!Number.isFinite(length) || length <= JOIN_EPS) return null;
        return { x: vector.x / length, z: vector.z / length };
    }

    private static intersectRayWithLine(
        rayOrigin: IPoint2D,
        rayDirection: IPoint2D,
        linePoint: IPoint2D,
        lineDirection: IPoint2D,
    ): { point: IPoint2D; t: number } | null {
        const det = rayDirection.x * lineDirection.z - rayDirection.z * lineDirection.x;
        if (Math.abs(det) <= JOIN_EPS) return null;
        const t = ((linePoint.x - rayOrigin.x) * lineDirection.z - (linePoint.z - rayOrigin.z) * lineDirection.x) / det;
        if (!Number.isFinite(t)) return null;
        return {
            t,
            point: {
                x: rayOrigin.x + rayDirection.x * t,
                z: rayOrigin.z + rayDirection.z * t,
            },
        };
    }

    static joinRoads(
        parent: THREE.Object3D,
        previousRoadExit: PrimitiveExit,
        nextRoadEntry: PrimitiveEntry,
        roadType: IRoadType,
        options: JoiningPrimitiveOptions = {},
    ) {
        void new JoiningRoadPrimitives({
            parent,
            roadType,
            previousRoadExit,
            nextRoadEntry,
            joiningPrimitiveOptions: options,
            geometry: null as unknown as ArcJoinGeometry, // will be created in constructor
        });

    }

    static createJoiningRoadsPrimitive(
        parent: THREE.Object3D,
        previousRoadExit: PrimitiveExit,
        nextRoadEntry: PrimitiveEntry,
        roadType: IRoadType,
        options: JoiningPrimitiveOptions = {},
    ): CurvedJoiningRoad | TightJoiningRoad | null {

        const requestedRadius = typeof options.radius === 'number' && Number.isFinite(options.radius) ? Math.max(0, Math.abs(options.radius)) : 6;

        const arcGeometry = this.computeCurvedJoinGeometry(previousRoadExit, nextRoadEntry, requestedRadius);
        if (arcGeometry) {
            this.applyStraightNeighborCuts(previousRoadExit, nextRoadEntry, arcGeometry.previousRoadExitTrim, arcGeometry.nextRoadEntryTrim);
            const result = new CurvedJoiningRoad({
                parent,
                roadType,
                previousRoadExit,
                nextRoadEntry,
                joiningPrimitiveOptions: options,
                geometry: arcGeometry,
            });
            return result;
        }
        const tightGeometry = this.computeTightJoinGeometry(previousRoadExit, nextRoadEntry, roadType, requestedRadius);
        if (tightGeometry) {
            this.applySharpNeighborCuts(previousRoadExit, nextRoadEntry);
            const result = new TightJoiningRoad({
                parent,
                roadType,
                previousRoadExit,
                nextRoadEntry,
                geometry: tightGeometry
            });
            return result;
        }
        this.debug('joinRoads: no curved or tight geometry possible');
        return null;
    }
}
