import { IPosition } from "./IPoint";
import { MinHeap } from "./MinHeap";
import { ICarPath } from "./SimCars";
import { SimTile, SimTiles } from "./SimTiles";

type Tile = SimTile;

export interface ITilePath extends ICarPath, IPosition {
    tile: SimTile;
    gScore: number; // accumulated cost so far
    hScore: number; // expected remaining cost 
    fScore: number; // total cost
    cost: number;
    cameFrom: ITilePath | undefined;
    x: number;
    y: number;
    speed: number;
}

const MAX_OPEN_SET = 1000;

//const pathCache = new LRU<string, ITilePath[] | null>({ max: 1000 });
//const nearestCache = new LRU<string, Tile | null>({ max: 1000 });

function aStar(
    startTile: Tile,
    isGoal: (tile: Tile) => boolean,
    getHeuristic: (tile: Tile) => number,
    useHeuristic: boolean
): { success: boolean, tilePath: ITilePath | null, openSet: MinHeap<ITilePath> } {
    
    const closedSet = new Set<Tile>();
    const gScoreMap = new Map<Tile, number>();
    gScoreMap.set(startTile, 0);

    const h = getHeuristic(startTile)
    const startPath: ITilePath = {
        x: startTile.x,
        y: startTile.y,
        tile: startTile,
        gScore: 0,
        hScore: h,
        fScore: 0 + h,
        cost: 0,
        cameFrom: undefined,
        speed: 1
    };

    const openSet = new MinHeap<ITilePath>(p => useHeuristic ? p.fScore : p.gScore);
    openSet.push(startPath);

    while (openSet.size > 0 && openSet.size < MAX_OPEN_SET) {
        const currentPath = openSet.pop()!;
        const currentTile = currentPath.tile;

        if (isGoal(currentTile)) {
            return { success: true, tilePath: currentPath, openSet }
        }

        closedSet.add(currentTile);

        for (const neighbour0 of currentTile.neighbours) {
            let neighbour = neighbour0.tile;
            if (closedSet.has(neighbour)) continue;

            const cost = neighbour0.drive;
            const g = gScoreMap.get(currentTile)! + cost;
            const h = getHeuristic(neighbour);
            const f = g + h

            if (gScoreMap.has(neighbour) && g >= gScoreMap.get(neighbour)!) continue;
            gScoreMap.set(neighbour, g);

            const path: ITilePath = {
                x: neighbour.x,
                y: neighbour.y,
                tile: neighbour,
                gScore: g,
                hScore: h,
                fScore: f,
                cost: cost,
                cameFrom: currentPath,
                speed: 1
            };
            // if (title != null) {
            //     neighbour.text = (
            //         title + "\n" +
            //         neighbour.x + "x" + neighbour.y + "\n" +
            //         "g:" + path.gScore.toFixed(1) + "\n" +
            //         "f:" + path.fScore.toFixed(1));

            // }
            openSet.push(path);
        }
    }
    return { success: false, tilePath: null, openSet }


}

// export function findPath(origin: IPosition, destination: IPosition): ITilePath[] | null {
//     if (!destination) return null;
//     const startTile = this.game.world.getTile(origin);
//     const endTile = this.game.world.getTile(destination);

//     let result = aStar(
//         startTile,
//         (tile) => tile === endTile,
//         (tile) => calculateHeuristic(tile, destination),
//         true);
//     let path: ITilePath[] | null;
//     if (result.success) {
//         path = result.success ? reconstructPath(result.tilePath!) : null;
//     } else path = null;
//     return path;
// }

export function findPathOrStartOfPath(simTiles: SimTiles, origin: IPosition, destination: IPosition): { success: boolean, path: ITilePath[] } {

    const startTile = simTiles.getTile(origin);
    const endTile = simTiles.getTile(destination);

    if (!startTile || !endTile) return { success: false, path: [] };

    let result = aStar(
        startTile,
        (tile) => tile === endTile,
        (tile) => calculateHeuristic(tile, destination),
        true,
        //  "path",
    );
    let path: ITilePath[] | null;

    if (result.success) {
        path = reconstructPath(result.tilePath!);
    } else {
        let best = findBestHScore(result.openSet.heap);
        path = reconstructPath(best);
    }
    return { success: result.success, path };

    function findBestHScore(heap: ITilePath[]): ITilePath {
        let minPath = heap[0];
        for (let i = 1; i < heap.length; i++) {
            const value = heap[i];
            if (isFinite(value.gScore) && value.hScore < minPath.hScore) minPath = value;
        }
        return minPath;
    }
}


export function findNearest(game: SimTiles, origin: IPosition, isFound: (t: Tile) => boolean): ITilePath[] | null {
    //const cacheKey = `nearest-${origin.x | 0},${origin.y | 0}`;
    //const cached = nearestCache.get(cacheKey);
    //if (cached) return cached;

    const startTile = game.getTile(origin);
    if (!startTile) return null;
    
    let result = aStar(
        startTile,
        isFound,
        () => 0,
        false,
        //  "nearest"
    );
    if (result.success) {
        let path = reconstructPath(result.tilePath!);
        return path;
    } else return null;
}

function calculateHeuristic(from: IPosition, to: IPosition): number {
    const manhattanTiles = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
    const manhattanKm = manhattanTiles * 0.016;
    const fastestSpeed = 130; // Fastest possible speed (highway)
    return (manhattanKm / fastestSpeed) * 3600; // Time in seconds with max speed
}


function reconstructPath(currentPath: ITilePath): ITilePath[] {
    const path: ITilePath[] = [];
    let current: ITilePath | undefined = currentPath;
    while (current) {
        path.unshift(current);
        current = current.cameFrom;
    }
    return path;
}
