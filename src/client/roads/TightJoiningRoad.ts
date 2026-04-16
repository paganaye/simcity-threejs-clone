import { StraightRoadPrimitive } from './StraightRoadPrimitive';
import type { IExtremityCut } from './RoadCuts';
import { JoiningRoadsParams } from './RoadJoin';
import { drawMarker } from '../Debug';
import { IPoint2D, Point2D } from '../../sim/Geometry';
import { PrimitiveExit, PrimitiveEntry } from './PrimitiveEndPoint';


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

        // Direction de la route suivante qui s'éloigne de l'entrée
        const entryDirection = entryPoint.direction();
        const exitDirection = exitPoint.direction();
        const carriageWayStart = joinArgs.roadType.carriagewayStart;
        const midCarriageway = joinArgs.roadType.midCarriageway;
        const carriageWayEnd = joinArgs.roadType.carriagewayEnd;
        const outerWidth = joinArgs.roadType.outerWidth;

        const dx = entryDirection.x + exitDirection.x;
        const dz = entryDirection.z + exitDirection.z;
        const slope = Math.abs(dz / dx) / 2;
        const angle = Math.atan2(dz, dx);
        let cutB: number, cutD: number, cutF: number, cutH: number, cutI: number;
        if (isFinite(slope)) {
            cutB = 0;
            cutD = carriageWayStart * slope;
            cutF = midCarriageway * slope;
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
        // const t = {
        //     x: ((entryI.x - entryB.x) + (exitI.x - exitB.x)) / 2,
        //     z: ((entryI.z - entryB.z) + (exitI.z - exitB.z)) / 2,
        // };
        // const start = { x: entryB.x + t.x, z: entryB.z + t.z };
        // const end = { x: start.x + bc.x, z: start.z + bc.z };
        // const ptA = { x: (entryPoint.x + exitPoint.x) / 2, z: (entryPoint.z + exitPoint.z) / 2 };

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

