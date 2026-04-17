import { StraightRoadPrimitive } from './StraightRoadPrimitive';
import type { IExtremityCut } from './RoadCuts';
import { JoiningRoadsParams } from './RoadJoin';
import { drawMarker } from '../Debug';
import { IPoint2D, Point2D } from '../../sim/Geometry';
import { PrimitiveExit, PrimitiveEntry } from './PrimitiveEndPoint';

const JOIN_EPS = 1e-6;


type TightJoinGeometry = {
    kind: 'tight';
    ptA: IPoint2D;
    start: IPoint2D;
    end: IPoint2D;
    previousRoadExitCut: IExtremityCut;
    nextRoadEntryCut: IExtremityCut;
    centerSegmentEntryCut: IExtremityCut;
    centerSegmentExitCut: IExtremityCut;

};

export class TightJoiningRoad extends StraightRoadPrimitive {
    private static readonly ZERO_CUT: IExtremityCut = { left: 0, roadLeft: 0, middle: 0, roadRight: 0, right: 0 };


    static computeTightJoinGeometry(
        joinArgs: JoiningRoadsParams
    ): TightJoinGeometry | null {

        const exitPoint = joinArgs.nextRoadEntry;    // point d'entrée de la route suivante (= b côté centre)
        const entryPoint = joinArgs.previousRoadExit; // point de sortie de la route précédente

        const previousAway = this.directionAwayFromSide(entryPoint);
        const nextAway = this.directionAwayFromSide(exitPoint);
        if (!previousAway || !nextAway) return null;

        // Travel direction at the junction: previous road comes into the node, then leaves on next road.
        const incoming = { x: -previousAway.x, z: -previousAway.z };
        const outgoing = nextAway;
        const carriageWayEnd = joinArgs.roadType.carriagewayEnd;
        const outerWidth = joinArgs.roadType.outerWidth;

        const dot = Math.max(-1, Math.min(1, incoming.x * outgoing.x + incoming.z * outgoing.z));
        const turnAngle = Math.acos(dot);
        const interiorTurnAngle = Math.min(turnAngle, Math.PI - turnAngle);
        const slope = interiorTurnAngle > JOIN_EPS && interiorTurnAngle < Math.PI - JOIN_EPS
            ? Math.tan(interiorTurnAngle / 2)
            : 0;

        const bisector = {
            x: incoming.x + outgoing.x,
            z: incoming.z + outgoing.z,
        };
        const angle = Math.atan2(bisector.z, bisector.x);
        let cutB: number, cutD: number, cutF: number, cutH: number, cutI: number;
        if (isFinite(slope)) {
            cutB = 0;
            cutD = 0;
            cutF = 0;
            cutH = carriageWayEnd * slope;
            cutI = outerWidth * slope;
        } else {
            cutB = 0;
            cutD = 0;
            cutF = 0;
            cutH = 0;
            cutI = 0;
        }
        const nextRoadEntryCut: IExtremityCut = {
            left: cutB,
            roadLeft: cutD,
            middle: cutF,
            roadRight: cutH,
            right: cutI,
        };

        const previousRoadExitCut: IExtremityCut = {
            left: cutB,
            roadLeft: cutD,
            middle: cutF,
            roadRight: cutH,
            right: cutI,
        };

        const a = { x: entryPoint.x, z: entryPoint.z };
        const ptB = Point2D.translate(a, angle, outerWidth / 2)
        const ptC = Point2D.translate(a, angle, -outerWidth / 2);
        const ptI = Point2D.translate(a, angle, 0);

        drawMarker('orange', ptB, joinArgs.parent);
        drawMarker('orange', ptC, joinArgs.parent);
        drawMarker('orange', ptI, joinArgs.parent);
  
        const start = entryPoint;
        const end = exitPoint;
        const ptA = { x: (entryPoint.x + exitPoint.x) / 2, z: (entryPoint.z + exitPoint.z) / 2 };
        const centerSegmentEntryCut: IExtremityCut = { ...this.ZERO_CUT };
        const centerSegmentExitCut: IExtremityCut = { ...this.ZERO_CUT };

        const result: TightJoinGeometry = {
            kind: 'tight',
            start,
            end,
            ptA,
            previousRoadExitCut,
            nextRoadEntryCut,
            centerSegmentEntryCut,
            centerSegmentExitCut,
        };
        showDebug(joinArgs, result);
        return result;

        function showDebug(joinArgs: JoiningRoadsParams, geometry: TightJoinGeometry): void {
            drawMarker('blue', geometry.ptA, joinArgs.parent);
        }

    }

    private static directionAwayFromSide(endpoint: PrimitiveEntry | PrimitiveExit): IPoint2D | null {
        const primitive = endpoint.primitive;
        const dx = primitive.exit.x - primitive.entry.x;
        const dz = primitive.exit.z - primitive.entry.z;
        const length = Math.hypot(dx, dz);
        if (!Number.isFinite(length) || length <= JOIN_EPS) return null;
        return endpoint.side === 'entry'
            ? { x: dx / length, z: dz / length }
            : { x: -dx / length, z: -dz / length };
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


        this.applySharpNeighborCuts(
            joinArgs.previousRoadExit,
            joinArgs.nextRoadEntry,
            geometry.previousRoadExitCut,
            geometry.nextRoadEntryCut,
        );

        const result = new TightJoiningRoad(joinArgs, geometry);
        return result;
    }

    constructor(
        params: JoiningRoadsParams,
        geometry: TightJoinGeometry) {
        super({
            parent: params.parent,
            segment: undefined,
            transient: true,
            entry: geometry.start,
            exit: geometry.end,
            roadType: params.roadType,
            cuts: {
                entryCut: geometry.centerSegmentEntryCut,
                exitCut: geometry.centerSegmentExitCut,
            },
        });
    }

}

