import * as THREE from 'three';
import type { IPoint2D } from '../../sim/IPoint';
import { CurvedRoadPrimitive } from './CurvedRoadPrimitive';
import type { PrimitiveEndPoint, PrimitiveSide } from './RoadPrimitive';
import type { RoadPrimitive } from './RoadPrimitive';

export type JoinPrimitiveOptions = {
    radius?: number;
};

function getEndpoint(primitive: RoadPrimitive, side: PrimitiveSide): PrimitiveEndPoint | undefined {
    return side === 'start' ? primitive.joinFrom : primitive.joinTo;
}

function setEndpoint(primitive: RoadPrimitive, side: PrimitiveSide, endpoint: PrimitiveEndPoint | undefined): void {
    if (side === 'start') {
        primitive.joinFrom = endpoint;
        return;
    }

    primitive.joinTo = endpoint;
}

function clearReciprocalLink(origin: RoadPrimitive, side: PrimitiveSide): void {
    const current = getEndpoint(origin, side);
    if (!current) return;

    const reciprocal = getEndpoint(current.primitive, current.side);
    if (reciprocal?.primitive === origin && reciprocal.side === side) {
        setEndpoint(current.primitive, current.side, undefined);
    }
}

function endpointPoint(primitive: RoadPrimitive, side: PrimitiveSide): IPoint2D {
    return side === 'start' ? primitive.start : primitive.end;
}

function setEndpointPoint(primitive: RoadPrimitive, side: PrimitiveSide, point: IPoint2D): void {
    if (side === 'start') {
        primitive.start = { x: point.x, z: point.z };
    } else {
        primitive.end = { x: point.x, z: point.z };
    }
}

function directionAwayFromSide(primitive: RoadPrimitive, side: PrimitiveSide): IPoint2D | null {
    const dx = primitive.end.x - primitive.start.x;
    const dz = primitive.end.z - primitive.start.z;
    const length = Math.hypot(dx, dz);
    if (!Number.isFinite(length) || length <= 1e-6) return null;

    if (side === 'start') {
        return { x: dx / length, z: dz / length };
    }

    return { x: -dx / length, z: -dz / length };
}

export function joinPrimitives(
    first: RoadPrimitive,
    firstSide: PrimitiveSide,
    second: RoadPrimitive,
    secondSide: PrimitiveSide,
    options: JoinPrimitiveOptions = {},
): RoadPrimitive | null {
    clearReciprocalLink(first, firstSide);
    clearReciprocalLink(second, secondSide);

    setEndpoint(first, firstSide, { primitive: second, side: secondSide });
    setEndpoint(second, secondSide, { primitive: first, side: firstSide });

    first.join = second;
    second.join = first;

    const { radius } = options;
    const normalizedRadius = typeof radius === 'number' && Number.isFinite(radius)
        ? Math.max(0, Math.abs(radius))
        : undefined;

    const p1 = endpointPoint(first, firstSide);
    const p2 = endpointPoint(second, secondSide);
    const d1 = directionAwayFromSide(first, firstSide);
    const d2 = directionAwayFromSide(second, secondSide);
    if (!d1 || !d2) {
        first.joinRadius = normalizedRadius;
        second.joinRadius = normalizedRadius;
        return null;
    }

    const node = {
        x: (p1.x + p2.x) / 2,
        z: (p1.z + p2.z) / 2,
    };

    const dot = THREE.MathUtils.clamp(d1.x * d2.x + d1.z * d2.z, -1, 1);
    const phi = Math.acos(dot);
    if (phi < 0.02 || phi > Math.PI - 0.02) {
        first.joinRadius = normalizedRadius;
        second.joinRadius = normalizedRadius;
        return null;
    }

    const tanHalf = Math.tan(phi / 2);
    if (!Number.isFinite(tanHalf) || tanHalf <= 1e-6) {
        first.joinRadius = normalizedRadius;
        second.joinRadius = normalizedRadius;
        return null;
    }

    const firstLength = Math.hypot(first.end.x - first.start.x, first.end.z - first.start.z);
    const secondLength = Math.hypot(second.end.x - second.start.x, second.end.z - second.start.z);
    const maxTrim = Math.max(0, Math.min(firstLength, secondLength) - 0.001);

    const requestedRadius = normalizedRadius ?? 6;
    const requestedTrim = requestedRadius / tanHalf;
    const trim = THREE.MathUtils.clamp(requestedTrim, 0, maxTrim);
    if (!Number.isFinite(trim) || trim <= 1e-6) {
        first.joinRadius = normalizedRadius;
        second.joinRadius = normalizedRadius;
        return null;
    }

    const actualRadius = trim * tanHalf;
    if (!Number.isFinite(actualRadius) || actualRadius <= 1e-6) {
        first.joinRadius = normalizedRadius;
        second.joinRadius = normalizedRadius;
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
        first.joinRadius = actualRadius;
        second.joinRadius = actualRadius;
        return null;
    }

    const sinHalf = Math.sin(phi / 2);
    if (!Number.isFinite(sinHalf) || sinHalf <= 1e-6) {
        first.joinRadius = actualRadius;
        second.joinRadius = actualRadius;
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
        first.joinRadius = actualRadius;
        second.joinRadius = actualRadius;
        return null;
    }

    const amid = a1 + delta / 2;
    const mid = {
        x: center.x + Math.cos(amid) * actualRadius,
        z: center.z + Math.sin(amid) * actualRadius,
    };

    setEndpointPoint(first, firstSide, end);
    setEndpointPoint(second, secondSide, start);

    first.joinRadius = actualRadius;
    second.joinRadius = actualRadius;

    return new CurvedRoadPrimitive({
        transient: true,
        direction: 'forward',
        start,
        mid,
        end,
        roadType: first.roadType,
    });
}
