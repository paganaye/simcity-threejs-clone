import { ModelName } from "../client/AssetManager";
import { IPos } from "./IPos";
import { random } from "./Rng";
import { Sim } from "./Sim";

export interface ITile {
    floor: ModelName;
    orientation: number;
    building?: ModelName | null;
    buildingOrientation?: number;
}

export type ITileChange = Partial<ITile> & IPos;

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
        for (let y = 0; y < height; y++) {
            let row = []
            for (let x = 0; x < width; x++) {
                let tile = new SimTile(this, x, y);
                row.push(tile);
                this.allTiles.push(tile);
            }
            this.tiles.push(row)
        }
        this.width = width;
        this.height = height;

        for (let t of this.allTiles) {
            t.computeNeighbours();
        }

    }

    randomTile(): SimTile {
        return this.getTile(random(this.width), random(this.height))!;
    }

    feedRandom() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let floor: ModelName = 'road-four-way'; //(random(2) == 0 ? random(roads) : 'grass');
                //let building = null //random(residentialBuildings);
                this.getTile(x, y)!.setFloor(floor, random(4) * 90)
                //this.getTile(x, y).setBuilding(building, random(4) * 90)
            }
        }
    }

    getTileChanged(): ITileChange[] {
        let result = new Array(...this.tileChanged.values())
        return result;
    }


    getTile(xy: IPos): SimTile | undefined
    getTile(x: number, y: number): SimTile | undefined
    getTile(xOrXy: number | IPos, y?: number): SimTile | undefined {
        if (typeof xOrXy === 'object') {
            return this.tiles[xOrXy.y]?.[xOrXy.x];
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

    constructor(readonly simTiles: SimTiles, readonly x: number, readonly y: number) {

    }


    computeNeighbours() {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx == 0 && dy == 0) continue;
                let t2 = this.simTiles.getTile(this.x + dx, this.y + dy);
                if (t2) {
                    let drive = (this.isRoad() && t2.isRoad()) ? 1 : MAXVALUE
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
    isRoad(): boolean {
        return true;
    }



    private getTileChange() {
        let tileChange = this.simTiles.tileChanged.get(this);
        if (!tileChange) {
            tileChange = { x: this.x, y: this.y };
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

