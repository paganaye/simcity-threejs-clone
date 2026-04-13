import * as THREE from 'three';
import type { IPoint2D } from '../../sim/IPoint';
import { CurvedRoadPrimitive } from './CurvedRoadPrimitive';
import type { PrimitiveSide } from './RoadPrimitive';
import type { RoadPrimitive } from './RoadPrimitive';

export type JoinPrimitiveOptions = {
    radius?: number;
};

function directionAwayFromSide(primitive: RoadPrimitive, side: PrimitiveSide): IPoint2D | null {
    const dx = primitive.endPos.x - primitive.startPos.x;
    const dz = primitive.endPos.z - primitive.startPos.z;
    const length = Math.hypot(dx, dz);
    if (!Number.isFinite(length) || length <= 1e-6) return null;

    if (side === 'start') {
        return { x: dx / length, z: dz / length };
    }

    return { x: -dx / length, z: -dz / length };
}

export function joinPrimitives(
    parent: THREE.Object3D,
    first: RoadPrimitive,
    firstSide: PrimitiveSide,
    second: RoadPrimitive,
    secondSide: PrimitiveSide,
    options: JoinPrimitiveOptions = {},
): RoadPrimitive | null {

    const { radius } = options;
    const normalizedRadius = typeof radius === 'number' && Number.isFinite(radius)
        ? Math.max(0, Math.abs(radius))
        : undefined;

    const p1 = first.getPoint(firstSide);
    const p2 = second.getPoint(secondSide);
    const d1 = directionAwayFromSide(first, firstSide);
    const d2 = directionAwayFromSide(second, secondSide);
    if (!d1 || !d2) {
        return null;
    }

    const node = {
        x: (p1.x + p2.x) / 2,
        z: (p1.z + p2.z) / 2,
    };

    const dot = THREE.MathUtils.clamp(d1.x * d2.x + d1.z * d2.z, -1, 1);
    const phi = Math.acos(dot);
    if (phi < 0.02 || phi > Math.PI - 0.02) {
        return null;
    }

    const tanHalf = Math.tan(phi / 2);
    if (!Number.isFinite(tanHalf) || tanHalf <= 1e-6) {
        return null;
    }

    const firstLength = Math.hypot(first.endPos.x - first.startPos.x, first.endPos.z - first.startPos.z);
    const secondLength = Math.hypot(second.endPos.x - second.startPos.x, second.endPos.z - second.startPos.z);
    const maxTrim = Math.max(0, Math.min(firstLength, secondLength) - 0.001);

    const requestedRadius = normalizedRadius ?? 6;
    const requestedTrim = requestedRadius / tanHalf;
    const trim = THREE.MathUtils.clamp(requestedTrim, 0, maxTrim);
    if (!Number.isFinite(trim) || trim <= 1e-6) {
        return null;
    }

    const actualRadius = trim * tanHalf;
    if (!Number.isFinite(actualRadius) || actualRadius <= 1e-6) {
        return null;
    }

    const end = {
        x: node.x + d1.x * trim,
        z: node.z + d1.z * trim,
    };
    const start = {
        x: node.x + d2.x * trim,
        z: node.z + d2.z * trim,
    };

    const bisector = {
        x: d1.x + d2.x,
        z: d1.z + d2.z,
    };
    const bisectorLength = Math.hypot(bisector.x, bisector.z);
    if (!Number.isFinite(bisectorLength) || bisectorLength <= 1e-6) {
        return null;
    }

    const sinHalf = Math.sin(phi / 2);
    if (!Number.isFinite(sinHalf) || sinHalf <= 1e-6) {
        return null;
    }

    const centerDistance = actualRadius / sinHalf;
    const center = {
        x: node.x + (bisector.x / bisectorLength) * centerDistance,
        z: node.z + (bisector.z / bisectorLength) * centerDistance,
    };

    const a1 = Math.atan2(end.z - center.z, end.x - center.x);
    const a2 = Math.atan2(start.z - center.z, start.x - center.x);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    if (Math.abs(delta) < 1e-6) {
        return null;
    }

    const amid = a1 + delta / 2;
    const mid = {
        x: center.x + Math.cos(amid) * actualRadius,
        z: center.z + Math.sin(amid) * actualRadius,
    };

    first.movePoint(firstSide, end);
    second.movePoint(secondSide, start);

    return new CurvedRoadPrimitive({
        parent,
        transient: true,
        direction: 'forward',
        start,
        mid,
        end,
        roadType: first.roadType,
    });
}
