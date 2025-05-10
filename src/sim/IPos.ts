export type IPosition = IPos;

export interface IPos {
    x: number;
    y: number;
}


export function tileFloor(position: IPos): IPos {
    return {
        x: Math.floor(position.x),
        y: Math.floor(position.y),
    };
}

export function tileCenter(position: IPos): IPos {
    return {
        x: Math.floor(position.x) + 0.5,
        y: Math.floor(position.y) + 0.5,
    };
}

export function distance(p1: IPos, p2: IPos): number {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

export function manhattanDistance(p1: IPos, p2: IPos): number {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y) * 1.2;
}

export function addHalfTile(position: IPos): IPos {
    return {
        x: position.x + 0.5,
        y: position.y + 0.5,
    };
}

export function removeHalfTile(position: IPos): IPos {
    return {
        x: position.x - 0.5,
        y: position.y - 0.5,
    };
}

export function positionFloorString(position: IPos) {
    return `${Math.floor(position.x)},${Math.floor(position.y)}`
}