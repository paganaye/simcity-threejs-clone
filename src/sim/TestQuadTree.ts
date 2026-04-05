import { QuadTree } from './QuadTree';
import { IPoint2D, IRectangle } from './IPoint';
import { assertTrue, expectError } from './Assert';


assertTrue("TestQuadTree", testQuadTree);

export function testQuadTree(): boolean {
    const boundary: IRectangle = { x: 0, z: 0, width: 100, height: 100 };
    const quadtree = new QuadTree<IPoint2D>(boundary, 16);
    const points: IPoint2D[] = [
        { x: 10, z: 10 },
        { x: 80, z: 80 },
        { x: 20, z: 80 },
        { x: 80, z: 20 },
        { x: 50, z: 50 },
    ];

    assertTrue('Insert points', () => {
        points.forEach(point => quadtree.insert(point));
        return true;
    });

    assertTrue("Search for point", () => {
        const found = quadtree.findPoint({ x: 10, z: 10 });
        if (found.length === 0) throw Error('Point not found.');
        return true;
    });

    assertTrue('Query rectangle', () => {
        const result = quadtree.queryRectangle({ x: 0, z: 0, width: 50, height: 50 });
        return result.length > 0;
    });

    expectError('Insert out-of-bounds points', "Point out of bounds", () => {
        [
            { x: 110, z: 110 },
            { x: 120, z: 120 },
        ].forEach(p => quadtree.insert(p));
    });

    expectError('Insert out-of-bounds points', "Point out of bounds", () => {
        [
            { x: 100, z: 100 },
        ].forEach(p => quadtree.insert(p));
    });

    assertTrue('Check sub-quadrants created', () => {
        const root = quadtree.root;
        return !!(root.northWest && root.northEast && root.southWest && root.southEast);
    });

    assertTrue('Check x/z child centers after subdivision', () => {
        const root = quadtree.root;
        if (!root.northWest || !root.northEast || !root.southWest || !root.southEast) return false;
        return (
            root.northWest.midX === 25 && root.northWest.midY === 25 &&
            root.northEast.midX === 25 && root.northEast.midY === 75 &&
            root.southWest.midX === 75 && root.southWest.midY === 25 &&
            root.southEast.midX === 75 && root.southEast.midY === 75
        );
    });

    assertTrue('Move in same leaf keeps single occurrence', () => {
        const p = points[0];
        const beforeLeaf = quadtree.debugFindLeafForPoint({ x: p.x, z: p.z });

        const oldX = p.x;
        const oldZ = p.z;
        p.x = 12;
        p.z = 12;
        quadtree.move(p, oldX, oldZ);

        const afterLeaf = quadtree.debugFindLeafForPoint({ x: p.x, z: p.z });
        return (
            quadtree.debugCountValueOccurrences(p) === 1 &&
            beforeLeaf.bounds.x === afterLeaf.bounds.x &&
            beforeLeaf.bounds.z === afterLeaf.bounds.z &&
            beforeLeaf.bounds.width === afterLeaf.bounds.width &&
            beforeLeaf.bounds.height === afterLeaf.bounds.height
        );
    });

    assertTrue('Move across leaves relocates value', () => {
        const p = points[0];
        const oldX = p.x;
        const oldZ = p.z;
        p.x = 90;
        p.z = 90;
        quadtree.move(p, oldX, oldZ);

        const atOldPos = quadtree.findPoint({ x: oldX, z: oldZ });
        const atNewPos = quadtree.findPoint({ x: 90, z: 90 });
        return atOldPos.indexOf(p) < 0 && atNewPos.indexOf(p) >= 0 && quadtree.debugCountValueOccurrences(p) === 1;
    });

    assertTrue('Move fallback works with stale old coordinates', () => {
        const p = points[0];
        p.x = 15;
        p.z = 85;
        quadtree.move(p, 1, 1);

        const atStale = quadtree.findPoint({ x: 90, z: 90 });
        const atNewPos = quadtree.findPoint({ x: 15, z: 85 });
        return atStale.indexOf(p) < 0 && atNewPos.indexOf(p) >= 0 && quadtree.debugCountValueOccurrences(p) === 1;
    });

    return true;
}

