import { QuadTree } from './QuadTree';
import { IPoint, IRectangle } from './IPoint';
import { assertTrue, expectError } from './Assert';


assertTrue("TestQuadTree", testQuadTree);

export function testQuadTree(): boolean {
    const boundary: IRectangle = { x: 0, y: 0, width: 100, height: 100 };
    const capacity = 4;
    const quadtree = new QuadTree<IPoint>(boundary, capacity);

    const points: IPoint[] = [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 30 },
        { x: 40, y: 40 },
        { x: 50, y: 50 },
    ];

    assertTrue('Insert points', () => {
        points.forEach(point => quadtree.insert(point));
        return true;
    });

    assertTrue("Search for point", () => {
        const found = quadtree.findPoint({ x: 20, y: 20 });
        if (found.length === 0) throw Error('Point not found.');
        return true;
    });

    assertTrue('Query rectangle', () => {
        const result = quadtree.queryRectangle({ x: 0, y: 0, width: 50, height: 50 });
        return result.length > 0;
    });

    expectError('Insert out-of-bounds points', "Point out of bounds", () => {
        [
            { x: 110, y: 110 },
            { x: 120, y: 120 },
        ].forEach(p => quadtree.insert(p));
    });

    expectError('Insert out-of-bounds points', "Point out of bounds", () => {
        [
            { x: 100, y: 100 },
        ].forEach(p => quadtree.insert(p));
    });

    assertTrue('Check sub-quadrants created', () => {
        const root = quadtree.root;
        return !!(root.northWest && root.northEast && root.southWest && root.southEast);
    });

    return true;
}

