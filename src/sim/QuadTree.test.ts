import { beforeEach, describe, expect, it } from 'vitest';
import { IPoint2D, IRectangle } from './Geometry';
import { QuadTree } from './QuadTree';

describe('QuadTree', () => {
  const boundary: IRectangle = { x: 0, z: 0, width: 1024, height: 1024 };
  let quadtree: QuadTree<IPoint2D>;
  let points: IPoint2D[];

  beforeEach(() => {
    quadtree = new QuadTree<IPoint2D>(boundary, 16);
    points = [
      { x: 10, z: 10 },
      { x: 80, z: 80 },
      { x: 20, z: 80 },
      { x: 80, z: 20 },
      { x: 50, z: 50 },
    ];
    points.forEach((point) => quadtree.insert(point));
  });

  it('inserts and finds points', () => {
    const found = quadtree.findPoint({ x: 10, z: 10 });
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(points[0]);
  });

  it('queries points in a rectangle', () => {
    const result = quadtree.queryRectangle({ x: 0, z: 0, width: 50, height: 50 });
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain(points[0]);
  });

  it('throws on out-of-bounds inserts', () => {
    expect(() => quadtree.insert({ x: 1100, z: 1100 })).toThrow('Point out of bounds');
    expect(() => quadtree.insert({ x: 1000, z: 1100 })).toThrow('Point out of bounds');
  });

  it('creates four sub-quadrants after subdivision', () => {
    const root = quadtree.root;
    expect(root.northWest).toBeDefined();
    expect(root.northEast).toBeDefined();
    expect(root.southWest).toBeDefined();
    expect(root.southEast).toBeDefined();
  });

  it('keeps expected child centers after subdivision', () => {
    const root = quadtree.root;
    expect(root.northWest).toBeDefined();
    expect(root.northEast).toBeDefined();
    expect(root.southWest).toBeDefined();
    expect(root.southEast).toBeDefined();

    expect(root.northWest!.midX).toBe(256);
    expect(root.northWest!.midY).toBe(256);
    expect(root.northEast!.midX).toBe(256);
    expect(root.northEast!.midY).toBe(768);
    expect(root.southWest!.midX).toBe(768);
    expect(root.southWest!.midY).toBe(256);
    expect(root.southEast!.midX).toBe(768);
    expect(root.southEast!.midY).toBe(768);
  });

  it('keeps one occurrence when moving inside the same leaf', () => {
    const p = points[0];
    const beforeLeaf = quadtree.debugFindLeafForPoint({ x: p.x, z: p.z });

    const oldX = p.x;
    const oldZ = p.z;
    p.x = 12;
    p.z = 12;
    quadtree.move(p, oldX, oldZ);

    const afterLeaf = quadtree.debugFindLeafForPoint({ x: p.x, z: p.z });
    expect(quadtree.debugCountValueOccurrences(p)).toBe(1);
    expect(afterLeaf.bounds).toEqual(beforeLeaf.bounds);
  });

  it('relocates value when moving across leaves', () => {
    const p = points[0];
    const oldX = p.x;
    const oldZ = p.z;
    p.x = 90;
    p.z = 90;
    quadtree.move(p, oldX, oldZ);

    const atOldPos = quadtree.findPoint({ x: oldX, z: oldZ });
    const atNewPos = quadtree.findPoint({ x: 90, z: 90 });

    expect(atOldPos).not.toContain(p);
    expect(atNewPos).toContain(p);
    expect(quadtree.debugCountValueOccurrences(p)).toBe(1);
  });

  it('uses fallback move when old coordinates are stale', () => {
    const p = points[0];
    const stalePos = { x: p.x, z: p.z };

    p.x = 15;
    p.z = 85;
    quadtree.move(p, 1, 1);

    const atStale = quadtree.findPoint(stalePos);
    const atNewPos = quadtree.findPoint({ x: 15, z: 85 });
    expect(atStale).not.toContain(p);
    expect(atNewPos).toContain(p);
    expect(quadtree.debugCountValueOccurrences(p)).toBe(1);
  });
});
