import { IPoint2D, IRectangle, rectangleContains, rectangleIntersects } from './Geometry';

interface IQuadTreeNode<T extends IPoint2D> {
    values?: T[];
    northWest?: IQuadTreeNode<T>;
    northEast?: IQuadTreeNode<T>;
    southWest?: IQuadTreeNode<T>;
    southEast?: IQuadTreeNode<T>;
    parent?: IQuadTreeNode<T>;
    midX: number;
    midY: number;
    width: number;
    height: number;
}

export class QuadTree<T extends IPoint2D> {
    root: IQuadTreeNode<T>;

    /**
     * @param minCellSize Minimum cell full-width/height in the same units as the boundary.
     *                    Subdivision stops when a cell would become smaller than this.
     *                    0 means no limit.
     */
    constructor(readonly boundary: IRectangle,
        readonly minCellSize: number = 1) {
        let w2 = boundary.width / 2;
        let h2 = boundary.height / 2;
        let midX = boundary.x + w2;
        let midY = boundary.z + h2;
        this.root = { midX, midY, width: w2, height: h2 };
    }

    insert(value: T) {
        if (!rectangleContains(this.boundary, value)) {
            throw Error("Point out of bounds");
        }
        this.#insertIntoNode(this.root, value);
        return true;
    }

    #insertIntoNode(node: IQuadTreeNode<T>, value: T): void {
        if (node.northWest) {
            const xLow = value.x < node.midX;
            const zLow = value.z < node.midY;
            const quarter = xLow ? (zLow ? node.northWest : node.northEast) : (zLow ? node.southWest : node.southEast);
            this.#insertIntoNode(quarter!, value);
        } else if (!node.values) {
            node.values = [value];
        } else if (node.width <= this.minCellSize) {
            node.values!.push(value);
            return;
        } else {
            this.#subdivideNode(node);
            this.#insertIntoNode(node, value);
        }
    }

    #subdivideNode(node: IQuadTreeNode<T>): void {
        const width2 = node.width / 2;
        const height2 = node.height / 2;

        const xLowMid = node.midX - width2;
        const zLowMid = node.midY - height2;
        const xHighMid = node.midX + width2;
        const zHighMid = node.midY + height2;

        node.northWest = { midX: xLowMid, midY: zLowMid, width: width2, height: height2, parent: node };
        node.northEast = { midX: xLowMid, midY: zHighMid, width: width2, height: height2, parent: node };
        node.southWest = { midX: xHighMid, midY: zLowMid, width: width2, height: height2, parent: node };
        node.southEast = { midX: xHighMid, midY: zHighMid, width: width2, height: height2, parent: node };

        let values = node.values!;
        node.values = undefined;
        for (let v of values) {
            this.#insertIntoNode(node, v);
        }
    }

    /**
     * Update a value that has already moved from (oldX, oldZ) to its current x/z.
     * Descends to the old leaf, and if the value hasn't left that cell does nothing.
     * Otherwise removes it and walks up parent pointers to the nearest ancestor
     * that contains the new position before re-inserting.
     */
    move(value: T, oldX: number, oldZ: number): void {
        if (!rectangleContains(this.boundary, value)) return;

        const leaf = this.#findNode(this.root, oldX, oldZ);
        const idx = leaf.values?.indexOf(value) ?? -1;

        // Common case: value hasn't crossed a cell boundary and is actually
        // still stored in this leaf.
        if (idx >= 0 && this.#nodeContains(leaf, value)) return;

        if (idx >= 0) {
            leaf.values!.splice(idx, 1);
        } else {
            // Fallback: tree can become stale if old coordinates no longer map
            // to the node currently holding this value.
            this.#removeFromNode(this.root, value);
        }

        // Walk up parent pointers until we find the lowest ancestor that contains
        // the new position, then let insertIntoNode descend from there.
        let target: IQuadTreeNode<T> = idx >= 0 ? (leaf.parent ?? this.root) : this.root;
        while (target.parent && !this.#nodeContains(target, value)) {
            target = target.parent;
        }
        this.#insertIntoNode(target, value);
    }

    #removeFromNode(node: IQuadTreeNode<T>, value: T): boolean {
        if (node.values) {
            const idx = node.values.indexOf(value);
            if (idx >= 0) {
                node.values.splice(idx, 1);
                return true;
            }
            return false;
        }

        if (!node.northWest) return false;
        if (this.#removeFromNode(node.northWest, value)) return true;
        if (this.#removeFromNode(node.northEast!, value)) return true;
        if (this.#removeFromNode(node.southWest!, value)) return true;
        if (this.#removeFromNode(node.southEast!, value)) return true;
        return false;
    }

    #findNode(node: IQuadTreeNode<T>, x: number, z: number): IQuadTreeNode<T> {
        if (!node.northWest) return node;
        const xLow = x < node.midX;
        const zLow = z < node.midY;
        const quarter = xLow
            ? (zLow ? node.northWest : node.northEast)
            : (zLow ? node.southWest : node.southEast);
        return this.#findNode(quarter!, x, z);
    }

    #nodeContains(node: IQuadTreeNode<T>, value: IPoint2D): boolean {
        return value.x >= node.midX - node.width &&
            value.x < node.midX + node.width &&
            value.z >= node.midY - node.height &&
            value.z < node.midY + node.height;
    }

    findPoint(point: IPoint2D): T[] {
        let result: T[] = [];
        let find = ((node: IQuadTreeNode<T>) => {
            if (node.values) {
                for (let v of node.values) {
                    if (v.x === point.x && v.z === point.z) {
                        result.push(v);
                    }
                }
            }
            if (node.northWest) {
                const xLow = point.x < node.midX;
                const zLow = point.z < node.midY;
                const quarter = xLow ? (zLow ? node.northWest : node.northEast) : (zLow ? node.southWest : node.southEast);
                find(quarter!);
            }
        });
        find(this.root);
        return result;
    }

    queryRectangle(rect: IRectangle): T[] {
        if (!rectangleIntersects(this.boundary, rect)) {
            return [];
        }
        let result: T[] = [];
        let rectRight = rect.x + rect.width;
        let rectBottom = rect.z + rect.height;
        let find = ((node: IQuadTreeNode<T>) => {
            if (node.values) {
                for (let v of node.values) {
                    if (rectangleContains(rect, v)) {
                        result.push(v);
                    }
                }
            }
            if (node.northWest) {
                // Must match insert/findNode quadrant mapping:
                // NW: x < midX, z < midY
                // NE: x < midX, z >= midY
                // SW: x >= midX, z < midY
                // SE: x >= midX, z >= midY
                const intersectsXLow = rect.x < node.midX;
                const intersectsXHigh = rectRight >= node.midX;
                const intersectsZLow = rect.z < node.midY;
                const intersectsZHigh = rectBottom >= node.midY;

                if (intersectsXLow && intersectsZLow) find(node.northWest!);
                if (intersectsXLow && intersectsZHigh) find(node.northEast!);
                if (intersectsXHigh && intersectsZLow) find(node.southWest!);
                if (intersectsXHigh && intersectsZHigh) find(node.southEast!);
            }
        });
        find(this.root);
        return result;
    }

    debugFindLeafForPoint(point: IPoint2D): { depth: number; bounds: IRectangle; valueCount: number } {
        return this.#debugFindLeafForPoint(this.root, point, 0);
    }

    #debugFindLeafForPoint(node: IQuadTreeNode<T>, point: IPoint2D, depth: number): { depth: number; bounds: IRectangle; valueCount: number } {
        if (!node.northWest) {
            return {
                depth,
                bounds: {
                    x: node.midX - node.width,
                    z: node.midY - node.height,
                    width: node.width * 2,
                    height: node.height * 2,
                },
                valueCount: node.values?.length ?? 0,
            };
        }

        const xLow = point.x < node.midX;
        const zLow = point.z < node.midY;
        const quarter = xLow
            ? (zLow ? node.northWest : node.northEast)
            : (zLow ? node.southWest : node.southEast);
        return this.#debugFindLeafForPoint(quarter!, point, depth + 1);
    }

    debugCountValueOccurrences(value: T): number {
        return this.#debugCountValueOccurrences(this.root, value);
    }

    #debugCountValueOccurrences(node: IQuadTreeNode<T>, value: T): number {
        if (node.values) {
            let count = 0;
            for (const v of node.values) {
                if (v === value) count++;
            }
            return count;
        }
        if (!node.northWest) return 0;
        return (
            this.#debugCountValueOccurrences(node.northWest, value) +
            this.#debugCountValueOccurrences(node.northEast!, value) +
            this.#debugCountValueOccurrences(node.southWest!, value) +
            this.#debugCountValueOccurrences(node.southEast!, value)
        );
    }

    debugQueryRectangleStats(rect: IRectangle): { visitedNodes: number; visitedLeaves: number; examinedValues: number; returnedValues: number } {
        let visitedNodes = 0;
        let visitedLeaves = 0;
        let examinedValues = 0;
        let returnedValues = 0;
        const rectRight = rect.x + rect.width;
        const rectBottom = rect.z + rect.height;

        const walk = (node: IQuadTreeNode<T>): void => {
            visitedNodes++;

            if (node.values) {
                visitedLeaves++;
                for (const v of node.values) {
                    examinedValues++;
                    if (rectangleContains(rect, v)) {
                        returnedValues++;
                    }
                }
                return;
            }

            if (!node.northWest) return;
            const intersectsXLow = rect.x < node.midX;
            const intersectsXHigh = rectRight >= node.midX;
            const intersectsZLow = rect.z < node.midY;
            const intersectsZHigh = rectBottom >= node.midY;

            if (intersectsXLow && intersectsZLow) walk(node.northWest);
            if (intersectsXLow && intersectsZHigh) walk(node.northEast!);
            if (intersectsXHigh && intersectsZLow) walk(node.southWest!);
            if (intersectsXHigh && intersectsZHigh) walk(node.southEast!);
        };

        walk(this.root);
        return { visitedNodes, visitedLeaves, examinedValues, returnedValues };
    }

    debugTreeStats(): { nodeCount: number; leafCount: number; maxDepth: number; totalValues: number } {
        let nodeCount = 0;
        let leafCount = 0;
        let maxDepth = 0;
        let totalValues = 0;

        const walk = (node: IQuadTreeNode<T>, depth: number): void => {
            nodeCount++;
            if (depth > maxDepth) maxDepth = depth;
            if (node.values) {
                leafCount++;
                totalValues += node.values.length;
                return;
            }
            if (!node.northWest) return;
            walk(node.northWest, depth + 1);
            walk(node.northEast!, depth + 1);
            walk(node.southWest!, depth + 1);
            walk(node.southEast!, depth + 1);
        };

        walk(this.root, 0);
        return { nodeCount, leafCount, maxDepth, totalValues };
    }

    debugLocateValue(value: T): { found: boolean; depth: number; bounds?: IRectangle } {
        return this.#debugLocateValue(this.root, value, 0);
    }

    #debugLocateValue(node: IQuadTreeNode<T>, value: T, depth: number): { found: boolean; depth: number; bounds?: IRectangle } {
        if (node.values) {
            if (node.values.includes(value)) {
                return {
                    found: true,
                    depth,
                    bounds: {
                        x: node.midX - node.width,
                        z: node.midY - node.height,
                        width: node.width * 2,
                        height: node.height * 2,
                    },
                };
            }
            return { found: false, depth };
        }

        if (!node.northWest) return { found: false, depth };
        const nw = this.#debugLocateValue(node.northWest, value, depth + 1);
        if (nw.found) return nw;
        const ne = this.#debugLocateValue(node.northEast!, value, depth + 1);
        if (ne.found) return ne;
        const sw = this.#debugLocateValue(node.southWest!, value, depth + 1);
        if (sw.found) return sw;
        const se = this.#debugLocateValue(node.southEast!, value, depth + 1);
        if (se.found) return se;
        return { found: false, depth };
    }
}
