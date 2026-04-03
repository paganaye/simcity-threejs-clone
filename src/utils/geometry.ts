export type Vec2 = { x: number; z: number };

export type PolygonAabb = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export function rotateAndTranslatePolygon(poly: Array<{ x: number; z: number }>, tx: number, tz: number, angle: number): Vec2[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return poly.map((p) => ({
    x: tx + p.x * c - p.z * s,
    z: tz + p.x * s + p.z * c,
  }));
}

export function getPolygonAabb(poly: Vec2[]): PolygonAabb {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { minX, maxX, minZ, maxZ };
}

export function aabbOverlap(a: PolygonAabb, b: PolygonAabb): boolean {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxZ < b.minZ || b.maxZ < a.minZ);
}

export function polygonInsideBounds(poly: Vec2[], minX: number, minZ: number, maxX: number, maxZ: number): boolean {
  for (const p of poly) {
    if (p.x < minX || p.x > maxX || p.z < minZ || p.z > maxZ) return false;
  }
  return true;
}

export function polygonsIntersectSAT(a: Vec2[], b: Vec2[]): boolean {
  const axes = getAxes(a).concat(getAxes(b));
  for (const axis of axes) {
    const pa = projectPolygon(a, axis);
    const pb = projectPolygon(b, axis);
    if (pa.max < pb.min || pb.max < pa.min) return false;
  }
  return true;
}

function getAxes(poly: Vec2[]): Vec2[] {
  const axes: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p0 = poly[i];
    const p1 = poly[(i + 1) % poly.length];
    const edgeX = p1.x - p0.x;
    const edgeZ = p1.z - p0.z;
    const nx = -edgeZ;
    const nz = edgeX;
    const len = Math.hypot(nx, nz);
    if (len > 1e-6) axes.push({ x: nx / len, z: nz / len });
  }
  return axes;
}

function projectPolygon(poly: Vec2[], axis: Vec2): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    const d = p.x * axis.x + p.z * axis.z;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}
