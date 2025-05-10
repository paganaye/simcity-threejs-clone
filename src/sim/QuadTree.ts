import { IPoint2D, IRectangle, rectangleContains, rectangleIntersects } from './IPoint';

interface IQuadTreeNode<T extends IPoint2D> {
    values?: T[];
    northWest?: IQuadTreeNode<T>;
    northEast?: IQuadTreeNode<T>;
    southWest?: IQuadTreeNode<T>;
    southEast?: IQuadTreeNode<T>;
    midX: number;
    midY: number;
    width: number;
    height: number;
}

export class QuadTree<T extends IPoint2D> {
    root: IQuadTreeNode<T>;

    constructor(readonly boundary: IRectangle, readonly capacity: number) {
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
            let north = value.x < node.midX;
            let west = value.z < node.midY;
            let quarter = north ? (west ? node.northWest : node.northEast) : (west ? node.southWest : node.southEast);
            this.#insertIntoNode(quarter!, value);
        } else if (!node.values) {
            node.values = [value];
        } else if (node.values!.length < this.capacity) {
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

        let x1 = node.midX - width2;
        let y1 = node.midY - height2;
        let x2 = node.midX + width2;
        let y2 = node.midY + height2;

        node.northWest = { midX: x1, midY: y1, width: width2, height: height2 };
        node.northEast = { midX: x2, midY: y1, width: width2, height: height2 };
        node.southWest = { midX: x1, midY: y2, width: width2, height: height2 };
        node.southEast = { midX: x2, midY: y2, width: width2, height: height2 };

        let values = node.values!;
        node.values = undefined;
        for (let v of values) {
            this.#insertIntoNode(node, v);
        }
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
                let north = point.x < node.midX;
                let west = point.z < node.midY;
                let quarter = north ? (west ? node.northWest : node.northEast) : (west ? node.southWest : node.southEast);
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
                let intersectsWest = rect.x < node.midX;
                let intersectsEast = rectRight >= node.midX;
                let intersectsNorth = rect.z < node.midY;
                let intersectsSouth = rectBottom >= node.midY;
                if (intersectsNorth && intersectsWest) find(node.northWest!);
                if (intersectsNorth && intersectsEast) find(node.northEast!);
                if (intersectsSouth && intersectsWest) find(node.southWest!);
                if (intersectsSouth && intersectsEast) find(node.southEast!);
            }
        });
        find(this.root);
        return result;
    }
}
