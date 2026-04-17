import * as THREE from 'three';
import { CurvedRoadPrimitive } from './CurvedRoadPrimitive';
import type { PrimitiveEndPoint, PrimitiveEntry, PrimitiveExit } from './PrimitiveEndPoint';
import { type JoiningRoadsParams } from './RoadJoin';
import { IPoint2D } from '../../sim/Geometry';
const JOIN_EPS = 1e-6;

type CurvedJoinGeometry = {
    kind: 'arc';
    start: IPoint2D;
    end: IPoint2D;
    center: IPoint2D;
    mid: { x: number; y: number; z: number };
    actualRadius: number;
    previousRoadExitTrim: number;
    nextRoadEntryTrim: number;
};


export class CurvedJoiningRoad extends CurvedRoadPrimitive {
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
            middle: nextRoadEntryTrim,
            roadRight: nextRoadEntryTrim,
            right: nextRoadEntryTrim,
        };
        const previousRoadCuts = previousRoadExit.primitive.cuts || (previousRoadExit.primitive.cuts = {});
        previousRoadCuts.exitCut = {
            left: previousRoadExitTrim,
            roadLeft: previousRoadExitTrim,
            middle: previousRoadExitTrim,
            roadRight: previousRoadExitTrim,
            right: previousRoadExitTrim,
        };

        nextRoadEntry.primitive.recreateMesh();
        previousRoadExit.primitive.recreateMesh();
    }

    static create(
        joinArgs: JoiningRoadsParams,
    ): CurvedJoiningRoad | null {

        const geometry = CurvedJoiningRoad.computeCurvedJoinGeometry(joinArgs);
        if (!geometry) return null;

        this.applyStraightNeighborCuts(
            joinArgs.previousRoadExit,
            joinArgs.nextRoadEntry,
            geometry.previousRoadExitTrim,
            geometry.nextRoadEntryTrim,
        );

        return new CurvedJoiningRoad(joinArgs, geometry);
    }

    constructor(params: JoiningRoadsParams,
        geometry: CurvedJoinGeometry) {
        super({
            parent: params.parent,
            segment: null as any,
            transient: true,
            entry: geometry.start,
            mid: geometry.mid,
            exit: geometry.end,
            roadType: params.roadType,
        });
    }



    static computeCurvedJoinGeometry(
        joinArgs: JoiningRoadsParams
    ): CurvedJoinGeometry | null {
        const d1 = this.directionAwayFromSide(joinArgs.nextRoadEntry);
        const d2 = this.directionAwayFromSide(joinArgs.previousRoadExit);
        if (!d1 || !d2) return null;

        const p1 = joinArgs.nextRoadEntry;
        const p2 = joinArgs.previousRoadExit;
        const det = d1.x * d2.z - d1.z * d2.x;
        if (Math.abs(det) <= JOIN_EPS) return null;

        const t = ((p2.x - p1.x) * d2.z - (p2.z - p1.z) * d2.x) / det;
        const node = { x: p1.x + d1.x * t, z: p1.z + d1.z * t };
        const dot = THREE.MathUtils.clamp(d1.x * d2.x + d1.z * d2.z, -1, 1);
        const phi = Math.acos(dot);
        if (phi < 0.02 || phi > Math.PI - 0.02) return null;

        const tanHalf = Math.tan(phi / 2);
        if (!Number.isFinite(tanHalf) || tanHalf <= JOIN_EPS) return null;

        const firstOpposite = joinArgs.nextRoadEntry.primitive.exit;
        const secondOpposite = joinArgs.previousRoadExit.primitive.entry;
        const firstPrimitiveLength = Math.hypot(
            firstOpposite.x - joinArgs.nextRoadEntry.x,
            firstOpposite.z - joinArgs.nextRoadEntry.z,
        );
        const secondPrimitiveLength = Math.hypot(
            secondOpposite.x - joinArgs.previousRoadExit.x,
            secondOpposite.z - joinArgs.previousRoadExit.z,
        );
        if (!Number.isFinite(firstPrimitiveLength) || !Number.isFinite(secondPrimitiveLength)) return null;

        const firstMaxTrim = (firstOpposite.x - node.x) * d1.x + (firstOpposite.z - node.z) * d1.z;
        const secondMaxTrim = (secondOpposite.x - node.x) * d2.x + (secondOpposite.z - node.z) * d2.z;
        const maxTrim = Math.max(
            0,
            Math.min(
                firstMaxTrim,
                secondMaxTrim,
            ) - 0.001,
        );
        const desiredTrim = joinArgs.radius / tanHalf;
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


}
