import * as THREE from 'three';
import type { IRoadType } from './IRoad';
import { StraightRoadPrimitive } from './StraightRoadPrimitive';
import type { PrimitiveEndPoint, PrimitiveEntry, PrimitiveExit } from './RoadPrimitive';
import type { IExtremityCut } from './RoadCuts';
import { intersectRayWithLine, EPSILON, normalize2D, type IPoint2D } from '../../sim/Geometry';
import { JoiningRoadsParams } from './RoadJoin';
import { appConstants } from '../../AppConstants';
import { RoadBands } from './RoadBands';

const TIGHT_SEGMENT_EPS = 0.05;
const TIGHT_MAX_CUT_RATIO = 0.48;
const TIGHT_NOSE_DEPTH_RATIO = 0.7;
const TIGHT_NOSE_DEPTH_WIDTH_RATIO = 0.9;
const TIGHT_TRIM_REDUCTION = 0.84;
const TIGHT_MIN_CENTER_SEGMENT_WIDTH_RATIO = 0.55;
const DEBUG_TIGHT_BISECTOR_LENGTH = 14;
const DEBUG_TIGHT_BISECTOR_HEIGHT = 0.08;
const DEBUG_TIGHT_BISECTOR_COLOR = 0xffaa00;

type TightJoinGeometry = {
    kind: 'tight';
    node: IPoint2D;
    bisector: IPoint2D;
    start: IPoint2D;
    end: IPoint2D;
    firstPoint: IPoint2D;
    secondPoint: IPoint2D;
    mid: { x: number; y: number; z: number };
    previousRoadExitTrim: number;
    nextRoadEntryTrim: number;
    previousRoadExitCut: IExtremityCut;
    nextRoadEntryCut: IExtremityCut;
    centerSegmentEntryCut: IExtremityCut;
    centerSegmentExitCut: IExtremityCut;
};

export class TightJoiningRoad extends StraightRoadPrimitive {
    private static readonly ZERO_CUT: IExtremityCut = { left: 0, roadLeft: 0, middle: 0, roadRight: 0, right: 0 };

    private static directionAwayFromSide(endpoint: PrimitiveEndPoint): IPoint2D | null {
        const primitive = endpoint.primitive;
        const dx = primitive.exit.x - primitive.entry.x;
        const dz = primitive.exit.z - primitive.entry.z;
        const length = Math.hypot(dx, dz);
        if (!Number.isFinite(length) || length <= EPSILON) return null;
        return endpoint.side === 'entry'
            ? { x: dx / length, z: dz / length }
            : { x: -dx / length, z: -dz / length };
    }

    private static getExtremityLateralSamples(roadType: IRoadType): [number, number, number, number, number] {
        const bands = RoadBands.get(roadType);
        const width = bands.totalWidthM;
        const leftOuter = width * 0.5;
        const roadLeft = leftOuter - bands.carriagewayStartM;
        const roadRight = leftOuter - bands.carriagewayEndM;
        const middle = (roadLeft + roadRight) * 0.5;
        const rightOuter = -leftOuter;
        return [leftOuter, roadLeft, middle, roadRight, rightOuter];
    }

    private static getPrimitiveSourceLength(endpoint: PrimitiveEndPoint): number {
        const fromSegment = endpoint.primitive.segment?.length;
        if (typeof fromSegment === 'number' && Number.isFinite(fromSegment) && fromSegment > EPSILON) {
            return fromSegment;
        }
        const primitive = endpoint.primitive;
        const dx = primitive.exit.x - primitive.entry.x;
        const dz = primitive.exit.z - primitive.entry.z;
        const directLength = Math.hypot(dx, dz);
        if (Number.isFinite(directLength) && directLength > EPSILON) {
            return directLength;
        }
        return 20;
    }

    private static computeExtremityCutTouchingBisector(params: {
        endpoint: PrimitiveEndPoint;
        roadType: IRoadType;
        segmentDirectionAwayFromSide: IPoint2D;
        bisector: IPoint2D;
        bisectorPoint: IPoint2D;
        availableLength: number;
    }): IExtremityCut {
        const {
            endpoint,
            roadType,
            segmentDirectionAwayFromSide,
            bisector,
            bisectorPoint,
            availableLength,
        } = params;
        const u = normalize2D(segmentDirectionAwayFromSide, EPSILON);
        const b = normalize2D(bisector, EPSILON);
        if (!u || !b) {
            return this.ZERO_CUT;
        }

        const maxAllowed = Math.max(0, availableLength * TIGHT_MAX_CUT_RATIO);
        const n = { x: -u.z, z: u.x };
        const lateral = this.getExtremityLateralSamples(roadType);
        const centerHit = intersectRayWithLine(endpoint, u, bisectorPoint, b, EPSILON);
        const centerTrim = THREE.MathUtils.clamp(centerHit?.t ?? 0, 0, maxAllowed);
        const values = lateral.map((z) => {
            const lateralOffset = endpoint.side === 'entry' ? -z : z;
            const rayOrigin = {
                x: endpoint.x + n.x * lateralOffset,
                z: endpoint.z + n.z * lateralOffset,
            };
            const hit = intersectRayWithLine(rayOrigin, u, bisectorPoint, b, EPSILON);
            if (!hit || !Number.isFinite(hit.t)) return centerTrim;
            return THREE.MathUtils.clamp(hit.t, 0, maxAllowed);
        });

        return {
            left: values[0],
            roadLeft: values[1],
            middle: values[2],
            roadRight: values[3],
            right: values[4],
        };
    }

    private static showDebug(joinArgs: JoiningRoadsParams, geometry: TightJoinGeometry): void {
        if (!appConstants.DEBUG_JOINING_ROAD) return;

        const y = ((joinArgs.nextRoadEntry.y ?? 0) + (joinArgs.previousRoadExit.y ?? 0)) * 0.5 + DEBUG_TIGHT_BISECTOR_HEIGHT;
        const start = new THREE.Vector3(
            geometry.node.x - geometry.bisector.x * DEBUG_TIGHT_BISECTOR_LENGTH,
            y,
            geometry.node.z - geometry.bisector.z * DEBUG_TIGHT_BISECTOR_LENGTH,
        );
        const end = new THREE.Vector3(
            geometry.node.x + geometry.bisector.x * DEBUG_TIGHT_BISECTOR_LENGTH,
            y,
            geometry.node.z + geometry.bisector.z * DEBUG_TIGHT_BISECTOR_LENGTH,
        );
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const lineMaterial = new THREE.LineBasicMaterial({ color: DEBUG_TIGHT_BISECTOR_COLOR, depthTest: false });
        const bisectorLine = new THREE.Line(lineGeometry, lineMaterial);
        bisectorLine.renderOrder = 1000;
        bisectorLine.name = 'debug-tight-bisector';


        const sphereGeometry = new THREE.SphereGeometry(0.4, 8, 8);

        const makeMarker = (color: string, pt: IPoint2D): void => {
            const material = new THREE.MeshBasicMaterial({ color, depthTest: false });
            const marker = new THREE.Mesh(sphereGeometry, material);
            marker.position.set(pt.x, y, pt.z);
            marker.renderOrder = 1001;
            joinArgs.parent.add(marker);
        };

        makeMarker('magenta', geometry.node)

        makeMarker('orange', geometry.firstPoint);
        makeMarker('orange', geometry.mid);
        makeMarker('orange', geometry.secondPoint);

        // Calculate intersections of the 3 dark-grey carriage lines.
        // const bands = RoadBands.get(joinArgs.roadType);
        // const widthM = bands.totalWidthM;
        // const halfWidth = widthM * 0.5;
        // const _roadLeft = halfWidth - bands.carriagewayStartM;
        // const _roadRight = halfWidth - bands.carriagewayEndM;




        const p1 = joinArgs.nextRoadEntry;
        // const p2 = joinArgs.previousRoadExit;
        const d1Data = this.directionAwayFromSide(joinArgs.nextRoadEntry);
        const d2Data = this.directionAwayFromSide(joinArgs.previousRoadExit);
        const d3Data = normalize2D({ x: geometry.end.x - geometry.start.x, z: geometry.end.z - geometry.start.z }, EPSILON);

        if (d1Data && d2Data && d3Data) {
            // const right1 = { x: d1Data.z, z: -d1Data.x };
            // const right2 = { x: d2Data.z, z: -d2Data.x };
            // const left2 = { x: -right2.x, z: -right2.z };
            // const right3 = { x: d3Data.z, z: -d3Data.x };

            // // Line 1: dark-grey edge of arm 1.
            // const line1Point = { x: p1.x + right1.x * roadRight, z: p1.z + right1.z * roadRight };
            // // Line 2: dark-grey edge of arm 2.
            // const line2Point = { x: p2.x + left2.x * roadLeft, z: p2.z + left2.z * roadLeft };
            // // Line 3: dark-grey edge of the center connector.
            // const line3Point = { x: geometry.start.x + right3.x * roadRight, z: geometry.start.z + right3.z * roadRight };

            // const i13 = intersectLines(line1Point, d1Data, line3Point, d3Data);
            // const i23 = intersectLines(line2Point, d2Data, line3Point, d3Data);
            // const i12 = intersectLines(line1Point, d1Data, line2Point, d2Data);

            // if (i13) joinArgs.parent.add(makeMarker('green', 'debug-tight-inner-intersection-13', i13.x, i13.z));

            // if (i23) joinArgs.parent.add(makeMarker('green', 'debug-tight-inner-intersection-23', i23.x, i23.z));

            // if (i12) joinArgs.parent.add(makeMarker('green', 'debug-tight-inner-intersection-12', i12.x, i12.z));

            makeMarker('blue', p1);
        }

        // joinArgs.parent.add(bisectorLine);
        // joinArgs.parent.add(nodeMarker);
        // joinArgs.parent.add(seamMarker);
        // joinArgs.parent.add(orangeFirst);
        // joinArgs.parent.add(orangeSecond);
        // joinArgs.parent.add(orangeThird);
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
        if (Math.abs(det) <= EPSILON) return null;

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
        if (!Number.isFinite(tanHalf) || tanHalf <= EPSILON) return null;

        const desiredTrim = joinArgs.radius / tanHalf;
        if (desiredTrim <= maxTrim + EPSILON) return null;

        const bisectorX = d1.x + d2.x;
        const bisectorZ = d1.z + d2.z;
        const bisectorLength = Math.hypot(bisectorX, bisectorZ);
        if (!Number.isFinite(bisectorLength) || bisectorLength <= EPSILON) return null;

        const bisector = { x: bisectorX / bisectorLength, z: bisectorZ / bisectorLength };
        const bisectorPerp = { x: -bisector.z, z: bisector.x };
        const bands = RoadBands.get(joinArgs.roadType);
        const widthM = bands.totalWidthM;
        const halfWidth = widthM * 0.5;
        const right1 = { x: d1.z, z: -d1.x };
        const right2 = { x: d2.z, z: -d2.x };
        const left1 = { x: -right1.x, z: -right1.z };
        const left2 = { x: -right2.x, z: -right2.z };

        const firstDebugPoint = {
            x: p2.x + left2.x * halfWidth,
            z: p2.z + left2.z * halfWidth,
        };
        const secondDebugPoint = {
            x: p1.x + right1.x * halfWidth,
            z: p1.z + right1.z * halfWidth,
        };

        const leftOffsetP1 = {
            x: p1.x + left1.x * halfWidth,
            z: p1.z + left1.z * halfWidth,
        };
        const leftOffsetP2 = {
            x: p2.x + right2.x * halfWidth,
            z: p2.z + right2.z * halfWidth,
        };
        const leftLinesDet = d1.x * d2.z - d1.z * d2.x;
        let violetPoint = { x: node.x, z: node.z };
        if (Math.abs(leftLinesDet) > EPSILON) {
            const leftT = ((leftOffsetP2.x - leftOffsetP1.x) * d2.z - (leftOffsetP2.z - leftOffsetP1.z) * d2.x) / leftLinesDet;
            violetPoint = {
                x: leftOffsetP1.x + d1.x * leftT,
                z: leftOffsetP1.z + d1.z * leftT,
            };
        }

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

        const first = intersectRayWithLine(node, d2, seamPoint, bisectorPerp, EPSILON);
        const second = intersectRayWithLine(node, d1, seamPoint, bisectorPerp, EPSILON);
        if (!first || !second) return null;

        if (first.t <= TIGHT_SEGMENT_EPS || second.t <= TIGHT_SEGMENT_EPS) return null;
        if (first.t >= maxTrim - TIGHT_SEGMENT_EPS || second.t >= maxTrim - TIGHT_SEGMENT_EPS) return null;

        const minSegmentMargin = Math.max(TIGHT_SEGMENT_EPS, widthM * 0.08);
        const minTrim = Math.max(first.t, second.t) + minSegmentMargin;
        if (minTrim >= maxTrim - EPSILON) return null;
        const targetTrim = maxTrim * TIGHT_TRIM_REDUCTION;
        const usedTrim = THREE.MathUtils.clamp(targetTrim, minTrim, maxTrim);

        const start = { x: node.x + d2.x * usedTrim, z: node.z + d2.z * usedTrim };
        const end = { x: node.x + d1.x * usedTrim, z: node.z + d1.z * usedTrim };

        const seg1Length = Math.hypot(first.point.x - start.x, first.point.z - start.z);
        const seg2Length = Math.hypot(second.point.x - first.point.x, second.point.z - first.point.z);
        const seg3Length = Math.hypot(end.x - second.point.x, end.z - second.point.z);
        if (seg1Length <= TIGHT_SEGMENT_EPS || seg2Length <= TIGHT_SEGMENT_EPS || seg3Length <= TIGHT_SEGMENT_EPS) return null;
        if (seg2Length < widthM * TIGHT_MIN_CENTER_SEGMENT_WIDTH_RATIO) return null;

        const u1 = normalize2D({ x: first.point.x - start.x, z: first.point.z - start.z }, EPSILON);
        const u2 = normalize2D({ x: second.point.x - first.point.x, z: second.point.z - first.point.z }, EPSILON);
        const u3 = normalize2D({ x: end.x - second.point.x, z: end.z - second.point.z }, EPSILON);
        if (!u1 || !u2 || !u3) return null;

        const seamNormal1 = normalize2D({ x: -u1.x + u2.x, z: -u1.z + u2.z }, EPSILON) ?? { x: -u1.z, z: u1.x };
        const seamNormal2 = normalize2D({ x: -u2.x + u3.x, z: -u2.z + u3.z }, EPSILON) ?? { x: -u3.z, z: u3.x };

        const secondEntryCut = this.computeMiterCut(u2, seamNormal1, 'entry', seg2Length, joinArgs.roadType);
        const secondExitCut = this.computeMiterCut(u2, seamNormal2, 'exit', seg2Length, joinArgs.roadType);

        const hidePreviousRoadCut = true;
        const hideNextRoadCut = true;


        const previousRoadExitCut = hidePreviousRoadCut ?
            { left: 10, roadLeft: 10, middle: 10, roadRight: 10, right: 10 }
            : this.computeExtremityCutTouchingBisector({
                endpoint: joinArgs.previousRoadExit,
                roadType: joinArgs.roadType,
                segmentDirectionAwayFromSide: d2,
                bisector,
                bisectorPoint: node,
                availableLength: this.getPrimitiveSourceLength(joinArgs.previousRoadExit),
            });
        const nextRoadEntryCut = hideNextRoadCut ?
            { left: 10, roadLeft: 10, middle: 10, roadRight: 10, right: 10 }
            : this.computeExtremityCutTouchingBisector({
                endpoint: joinArgs.nextRoadEntry,
                roadType: joinArgs.roadType,
                segmentDirectionAwayFromSide: d1,
                bisector,
                bisectorPoint: node,
                availableLength: this.getPrimitiveSourceLength(joinArgs.nextRoadEntry),
            });



        const mid = {
            x: violetPoint.x,
            y: ((p1.y ?? 0) + (p2.y ?? 0)) * 0.5,
            z: violetPoint.z,
        };

        const centerDirection = normalize2D({
            x: secondDebugPoint.x - firstDebugPoint.x,
            z: secondDebugPoint.z - firstDebugPoint.z,
        }, EPSILON);
        if (!centerDirection) return null;
        const centerRight = { x: centerDirection.z, z: -centerDirection.x };
        const centerStart = {
            x: firstDebugPoint.x - centerRight.x * halfWidth,
            z: firstDebugPoint.z - centerRight.z * halfWidth,
        };
        const centerEnd = {
            x: secondDebugPoint.x - centerRight.x * halfWidth,
            z: secondDebugPoint.z - centerRight.z * halfWidth,
        };

        return {
            kind: 'tight',
            node,
            bisector,
            start: centerStart,
            end: centerEnd,
            firstPoint: firstDebugPoint,
            secondPoint: secondDebugPoint,
            mid,
            previousRoadExitTrim: first.t,
            nextRoadEntryTrim: second.t,
            previousRoadExitCut,
            nextRoadEntryCut,
            centerSegmentEntryCut: secondEntryCut,
            centerSegmentExitCut: secondExitCut,
        };
    }

    private static computeMiterCut(
        segmentDirection: IPoint2D,
        seamNormal: IPoint2D,
        side: 'entry' | 'exit',
        length: number,
        roadType: IRoadType,
    ): IExtremityCut {
        const bands = RoadBands.get(roadType);
        const width = bands.totalWidthM;
        const leftOuter = width * 0.5;
        const roadLeft = leftOuter - bands.carriagewayStartM;
        const roadRight = leftOuter - bands.carriagewayEndM;
        const middle = (roadLeft + roadRight) * 0.5;
        const rightOuter = -leftOuter;
        const lateral = [leftOuter, roadLeft, middle, roadRight, rightOuter];

        const u = normalize2D(segmentDirection, EPSILON);
        const m = normalize2D(seamNormal, EPSILON);
        if (!u || !m) {
            return { left: 0, roadLeft: 0, middle: 0, roadRight: 0, right: 0 };
        }

        const uDotM = u.x * m.x + u.z * m.z;
        if (Math.abs(uDotM) <= EPSILON) {
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
        const scale = shiftedMax > EPSILON && shiftedMax > maxAllowed ? maxAllowed / shiftedMax : 1;
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
        previousRoadExitCut: IExtremityCut,
        nextRoadEntryCut: IExtremityCut,
    ): void {
        const nextRoadCuts = nextRoadEntry.primitive.cuts || (nextRoadEntry.primitive.cuts = {});
        nextRoadCuts.entryCut = nextRoadEntryCut;
        const previousRoadCuts = previousRoadExit.primitive.cuts || (previousRoadExit.primitive.cuts = {});
        previousRoadCuts.exitCut = previousRoadExitCut;
        nextRoadEntry.primitive.recreateMesh();
        previousRoadExit.primitive.recreateMesh();
    }

    static create(
        joinArgs: JoiningRoadsParams,
    ): TightJoiningRoad | null {

        const geometry = TightJoiningRoad.computeTightJoinGeometry(joinArgs);
        if (!geometry) return null;

        this.showDebug(joinArgs, geometry);

        this.applySharpNeighborCuts(
            joinArgs.previousRoadExit,
            joinArgs.nextRoadEntry,
            geometry.previousRoadExitCut,
            geometry.nextRoadEntryCut,
        );

        let result = new TightJoiningRoad(joinArgs, geometry);
        if (appConstants.DEBUG_JOINING_ROAD) {
            //(result.mesh as THREE.Object3D).name = 'tight-joining-road';
        }
        return result;
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
                entryCut: geometry.centerSegmentEntryCut,
                exitCut: geometry.centerSegmentExitCut,
            },
        });
    }

}
