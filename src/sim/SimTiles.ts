import { ModelName } from "../client/AssetManager";
import { IPoint2D } from "./IPoint";
import { random } from "./Rng";
import { Sim } from "./Sim";
import { TileContent, SimBuilding, SimGrass, SimRoad } from "./TileContent";

export interface ITile {
    floor: ModelName;
    orientation: number;
    building?: ModelName | null;
    buildingOrientation?: number;
}

export type ITileChange = Partial<ITile> & IPoint2D;

export class SimTiles {
    allTiles: SimTile[] = [];
    tiles: SimTile[][] = [];
    tileChanged = new Map<SimTile, ITileChange>();
    width: number = 0;
    height: number = 0;
    constructor(readonly simCity: Sim) { }

    setSize(width: number, height: number) {
        this.allTiles.length = 0;
        this.tiles.length = 0;
        for (let z = 0; z < height; z++) {
            let row = []
            for (let x = 0; x < width; x++) {
                let tile = new SimTile(this, x, z);
                row.push(tile);
                this.allTiles.push(tile);
            }
            this.tiles.push(row)
        }
        for (let z = 0; z < height; z++) {
            for (let x = 0; x < width; x++) {
                let tile = this.getTile(x, z)!;
                tile.northTile = this.getTile(x, z + 1) ?? null;
                tile.southTile = this.getTile(x, z - 1) ?? null;
                tile.westTile = this.getTile(x - 1, z) ?? null;
                tile.eastTile = this.getTile(x + 1, z) ?? null;
            }
        }
        this.width = width;
        this.height = height;
    }

    randomTile(filter?: (t: SimTile) => boolean): SimTile {
        return random(filter ? this.allTiles.filter(filter) : this.allTiles);
    }

    feedRandom() {
        for (let z = 0; z < this.height; z++) {
            for (let x = 0; x < this.width; x++) {
                let tile = this.getTile(x, z)!;
                if (random(0) == 0) {
                    // building
                    //setFloor(floor, random(4) * 90)
                    if (random(2) == 0) tile.setContent(new SimRoad(tile));
                    else tile.setContent(new SimGrass(tile));

                } else {
                    tile.setContent(SimBuilding.newRandom(tile));

                }
            }
        }
    }

    computeModels() {
        for (let t of this.allTiles) {
            t.content?.computeModel();
        }
        for (let t of this.allTiles) {
            t.computeNeighbours();
        }

    }

    getTileChanged(): ITileChange[] {
        const result = new Array(...this.tileChanged.values())
        this.tileChanged.clear();
        return result;
    }

    getTile(xy: IPoint2D): SimTile | undefined
    getTile(x: number, y: number): SimTile | undefined
    getTile(xOrXy: number | IPoint2D, y?: number): SimTile | undefined {
        if (typeof xOrXy === 'object') {
            return this.tiles[xOrXy.z]?.[xOrXy.x];
        } else {
            return this.tiles[y!]?.[xOrXy];
        }
    }
}

export interface MoveCost {
    tile: SimTile;
    walk: number;
    drive: number;
}

const MAXVALUE = Number.MAX_VALUE;

export class SimTile {
    neighbours: MoveCost[] = [];
    content!: TileContent;

    northTile!: SimTile | null;
    southTile!: SimTile | null;
    westTile!: SimTile | null;
    eastTile!: SimTile | null;


    constructor(readonly simTiles: SimTiles, readonly x: number, readonly z: number) {

    }

    toString() {
        return `${this.x}.${this.z} ${this.content}`;
    }


    setContent(content: TileContent) {
        this.content = content;
        content.updateTileChange();
    }


    computeNeighbours() {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx == 0 && dy == 0) continue;
                let t2 = this.simTiles.getTile(this.x + dx, this.z + dy);
                if (t2) {
                    let drive = (this.content.isRoad() && t2.content.isRoad()) ? 1 : MAXVALUE
                    let walk = MAXVALUE;
                    if (dx != 0 && dy != 0) drive = MAXVALUE; // for now
                    if (drive < MAXVALUE || walk < MAXVALUE) {
                        this.neighbours.push({
                            tile: t2,
                            walk,
                            drive
                        })
                    }
                }
            }
        }
    }

    private getTileChange() {
        let tileChange = this.simTiles.tileChanged.get(this);
        if (!tileChange) {
            tileChange = { x: this.x, z: this.z };
            this.simTiles.tileChanged.set(this, tileChange);
        }
        return tileChange;
    }

    setFloor(name: ModelName, orientation: number = 0) {
        let tileChange = this.getTileChange();
        tileChange.floor = name;
        tileChange.orientation = orientation;
    }

    setBuilding(name: ModelName | null, orientation: number = 0) {
        let tileChange = this.getTileChange();
        tileChange.building = name;
        tileChange.buildingOrientation = orientation;
    }



}

