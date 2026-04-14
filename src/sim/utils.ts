import { RAD2DEG } from 'three/src/math/MathUtils.js';
import { normalizeAngle } from './Geometry';

export const EPSILON = 0.0001;

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}

export function KmPerHour(v: number): number {
    return v / 3.6;
}

export function normalizeAngleDeg(angle: number): number {
    return normalizeAngle(angle) * RAD2DEG;
}

export function rotateTowards(current: number, target: number, maxDelta: number): number {
    const delta = normalizeAngle(target - current);
    if (Math.abs(delta) <= maxDelta) return target;
    return current + Math.sign(delta) * maxDelta;
}

