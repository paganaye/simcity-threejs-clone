export type IPosition = IPoint;

export interface IPoint {
    x: number;
    y: number;
}


export function tileFloor(position: IPoint): IPoint {
    return {
        x: Math.floor(position.x),
        y: Math.floor(position.y),
    };
}

export function tileCenter(position: IPoint): IPoint {
    return {
        x: Math.floor(position.x) + 0.5,
        y: Math.floor(position.y) + 0.5,
    };
}

export function distance(p1: IPoint, p2: IPoint): number {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

export function manhattanDistance(p1: IPoint, p2: IPoint): number {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y) * 1.2;
}

export function addHalfTile(position: IPoint): IPoint {
    return {
        x: position.x + 0.5,
        y: position.y + 0.5,
    };
}

export function removeHalfTile(position: IPoint): IPoint {
    return {
        x: position.x - 0.5,
        y: position.y - 0.5,
    };
}

export function positionFloorString(position: IPoint) {
    return `${Math.floor(position.x)},${Math.floor(position.y)}`
}

export interface IRectangle extends IPoint {
    width: number;
    height: number;
}

export function rectangleContains(self: IRectangle, IPos: IPoint): boolean {
    return IPos.x >= self.x && IPos.x < self.x + self.width && IPos.y >= self.y && IPos.y < self.y + self.height;
}

export function rectangleIntersects(self: IRectangle, range: IRectangle): boolean {
    return !(range.x + range.width <= self.x ||
        range.x >= self.x + self.width ||
        range.y + range.height <= self.y ||
        range.y >= self.y + self.height);
}