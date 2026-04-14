
export interface IPoint2D {
    x: number;
    y?: number;
    z: number;
}

export interface IPoint3D {
    x: number;
    y: number;
    z: number;
}

export type IVector2D = IPoint2D;
export type IVector3D = IPoint3D;



export interface IOrientation2D extends IPoint2D {
    angle: number;
}

export interface IMovement2D extends IPoint2D {
    angle: number;
    speed: number;
}

export function tileFloor(position: IPoint2D): IPoint2D {
    return {
        x: Math.floor(position.x),
        z: Math.floor(position.z),
    };
}

export function tileCenter(position: IPoint2D): IPoint2D {
    return {
        x: Math.floor(position.x) + 0.5,
        z: Math.floor(position.z) + 0.5,
    };
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const TWO_PI = Math.PI * 2;

export const DEG_0   = 0;
export const DEG_30  = Math.PI / 6;
export const DEG_60  = Math.PI / 3;
export const DEG_90  = Math.PI / 2;
export const DEG_120 = 2 * Math.PI / 3;
export const DEG_180 = Math.PI;
export const DEG_270 = 3 * Math.PI / 2;

// ─── Distance ────────────────────────────────────────────────────────────────

/** Distance between two IPoint2D (in world units). */
export function distance2D(p1: IPoint2D, p2: IPoint2D): number {
    return Math.hypot(p1.x - p2.x, p1.z - p2.z);
}


// ─── Angles ───────────────────────────────────────────────────────────────────

/** Angle of the vector from pt1 to pt2 (atan2(dz, dx)), in (-PI, PI]. */
export function getAngle(pt1: IPoint2D, pt2: IPoint2D): number {
    return Math.atan2(pt2.z - pt1.z, pt2.x - pt1.x);
}

/** Normalise an angle to (-PI, PI]. */
export function normalizeAngle(angle: number): number {
    let a = angle;
    while (a > Math.PI) a -= TWO_PI;
    while (a <= -Math.PI) a += TWO_PI;
    return a;
}

/** Signed turn angle at p1 when going p0→p1→p2. */
export function getCornerAngle(p0: IPoint2D, p1: IPoint2D, p2: IPoint2D): number {
    return normalizeAngle(getAngle(p1, p2) - getAngle(p0, p1));
}

/** Positive (CCW) delta from → to, in [0, 2π). */
export function positiveAngleDelta(from: number, to: number): number {
    let d = to - from;
    while (d < 0) d += TWO_PI;
    while (d >= TWO_PI) d -= TWO_PI;
    return d;
}

/** Positive (CW) delta from → to, in [0, 2π). */
export function negativeAngleDelta(from: number, to: number): number {
    let d = from - to;
    while (d < 0) d += TWO_PI;
    while (d >= TWO_PI) d -= TWO_PI;
    return d;
}

// ─── Vector algebra ──────────────────────────────────────────────────────────

export function addPoints(p1: IPoint2D, p2: IPoint2D): IPoint2D { return { x: p1.x + p2.x, z: p1.z + p2.z }; }
export function subtractPoints(p1: IPoint2D, p2: IPoint2D): IPoint2D { return { x: p1.x - p2.x, z: p1.z - p2.z }; }
export function scalePoint(p: IPoint2D, s: number): IPoint2D { return { x: p.x * s, z: p.z * s }; }
export function dotProduct(v1: IPoint2D, v2: IPoint2D): number { return v1.x * v2.x + v1.z * v2.z; }

export function normalizeVector(p: IVector2D): IVector2D {
    const d = Math.hypot(p.x, p.z);
    if (d === 0) return { x: 0, z: 0 };
    return { x: p.x / d, z: p.z / d };
}

export function midPoint(start: IPoint2D, end: IPoint2D): IPoint2D {
    return { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
}

// ─── Interpolation ───────────────────────────────────────────────────────────

export function lerp(start: number, end: number, progress: number): number {
    return end * progress + (1 - progress) * start;
}

export function lerpPoint(start: IPoint2D, end: IPoint2D, progress: number, output: IPoint2D): void {
    output.x = lerp(start.x, end.x, progress);
    output.z = lerp(start.z, end.z, progress);
}

// ─── Normal & offset ─────────────────────────────────────────────────────────

/** Right-hand perpendicular unit normal of the start→end segment. */
export function getRightNormal(start: IPoint2D, end: IPoint2D): IPoint2D {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    if (length <= 1e-6) return { x: 0, z: 0 };
    return { x: -dz / length, z: dx / length };
}

/** Translate a point along a normal by offsetM world units. */
export function offsetPoint(point: IPoint2D, normal: IPoint2D, offsetM: number): IPoint2D {
    if (offsetM === 0) return { x: point.x, z: point.z, y: point.y };
    return { x: point.x + normal.x * offsetM, z: point.z + normal.z * offsetM, y: point.y };
}

// ─── Arc helpers ─────────────────────────────────────────────────────────────

/**
 * Compute radius-limited corner arc tangent to the two segments pA→pB and pB→pC.
 * Returns null when the geometry is degenerate.
 */
export function calculateArc(pA: IPoint2D, pB: IPoint2D, pC: IPoint2D, maxRadius: number) {
    const EPSILON = 0.0001;
    const v1 = normalizeVector(subtractPoints(pA, pB));
    const v2 = normalizeVector(subtractPoints(pC, pB));
    const dot = Math.max(-1, Math.min(1, dotProduct(v1, v2)));
    const angle = Math.acos(dot);
    if (angle < EPSILON) return null;

    const len1 = distance2D(pA, pB);
    const len2 = distance2D(pC, pB);
    const radius = Math.min(maxRadius, len1, len2);
    const tanHalf = Math.tan(angle / 2);
    const offset = radius / tanHalf;

    const ptA = addPoints(pB, scalePoint(v1, offset));
    const ptB = addPoints(pB, scalePoint(v2, offset));

    const bisector = normalizeVector(addPoints(v1, v2));
    const centerOffset = radius / Math.sin(angle / 2);
    const center = addPoints(pB, scalePoint(bisector, centerOffset));

    const startAngle = Math.atan2(ptA.z - center.z, ptA.x - center.x);
    const endAngle   = Math.atan2(ptB.z - center.z, ptB.x - center.x);
    let sweep = endAngle - startAngle;
    if (sweep <= -Math.PI) sweep += TWO_PI;
    else if (sweep > Math.PI) sweep -= TWO_PI;

    return { ptA, ptB, center, radius, startAngle, sweep };
}

/**
 * Compute an arc starting at `origin` heading `direction`, turning by `sweep`
 * radians at the given `radius`.
 */
export function calculateTurnArc(origin: IPoint2D, direction: number, radius: number, sweep: number) {
    const side = Math.sign(sweep);
    const centerAngle = direction + side * Math.PI / 2;
    const center: IPoint2D = {
        x: origin.x + Math.cos(centerAngle) * radius,
        z: origin.z + Math.sin(centerAngle) * radius,
    };
    const startAngle = Math.atan2(origin.z - center.z, origin.x - center.x);
    const endAngle = startAngle + sweep;
    const final: IPoint2D = {
        x: center.x + Math.cos(endAngle) * radius,
        z: center.z + Math.sin(endAngle) * radius,
    };
    return { center, startAngle, endAngle: direction + sweep, radius, sweep, ptA: origin, ptB: final };
}

export interface IArc2D {
    center: IPoint2D;
    radius: number;
    startAngle: number;
    sweepAngle: number;
}

export function computeArcFromThreePoints(start: IPoint2D, mid: IPoint2D, end: IPoint2D): IArc2D | null {
    const d = 2 * (start.x * (mid.z - end.z) + mid.x * (end.z - start.z) + end.x * (start.z - mid.z));
    if (Math.abs(d) < 1e-6) return null;

    const aa = start.x * start.x + start.z * start.z;
    const bb = mid.x * mid.x + mid.z * mid.z;
    const cc = end.x * end.x + end.z * end.z;

    const cx = (aa * (mid.z - end.z) + bb * (end.z - start.z) + cc * (start.z - mid.z)) / d;
    const cz = (aa * (end.x - mid.x) + bb * (start.x - end.x) + cc * (mid.x - start.x)) / d;
    const radius = Math.hypot(start.x - cx, start.z - cz);
    if (!Number.isFinite(radius) || radius <= 1e-6) return null;

    const startAngle = Math.atan2(start.z - cz, start.x - cx);
    const midAngle = Math.atan2(mid.z - cz, mid.x - cx);
    const endAngle = Math.atan2(end.z - cz, end.x - cx);
    const ccwSweep = positiveAngleDelta(startAngle, endAngle);
    const ccwToMid = positiveAngleDelta(startAngle, midAngle);
    const sweepAngle = ccwToMid <= ccwSweep
        ? ccwSweep
        : -positiveAngleDelta(endAngle, startAngle);

    return {
        center: { x: cx, z: cz },
        radius,
        startAngle: normalizeAngle(startAngle),
        sweepAngle: normalizeAngle(sweepAngle),
    };
}

export function manhattanDistance(p1: IPoint2D, p2: IPoint2D): number {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.z - p2.z) * 1.2;
}

export function addHalfTile(position: IPoint2D): IPoint2D {
    return {
        x: position.x + 0.5,
        z: position.z + 0.5,
    };
}

export function removeHalfTile(position: IPoint2D): IPoint2D {
    return {
        x: position.x - 0.5,
        z: position.z - 0.5,
    };
}

export function positionFloorString(position: IPoint2D) {
    return `${Math.floor(position.x)},${Math.floor(position.z)}`
}

export interface IRectangle extends IPoint2D {
    width: number;
    height: number;
}

export function rectangleContains(self: IRectangle, IPoint2D: IPoint2D): boolean {
    return IPoint2D.x >= self.x && IPoint2D.x < self.x + self.width && IPoint2D.z >= self.z && IPoint2D.z < self.z + self.height;
}

export function rectangleIntersects(self: IRectangle, range: IRectangle): boolean {
    return !(range.x + range.width <= self.x ||
        range.x >= self.x + self.width ||
        range.z + range.height <= self.z ||
        range.z >= self.z + self.height);
}