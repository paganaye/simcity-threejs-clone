import { ModelName, roads } from "../client/AssetManager";
import { IPos } from "./IPos";
import { random } from "./Rng";
import { SimCity } from "./SimCity";

export interface ITile {
    floor: ModelName;
    orientation: number;
    building?: ModelName | null;
    buildingOrientation?: number;
}

export type ITileChange = Partial<ITile> & IPos;

export class SimTiles {
    tiles: SimTile[][] = [];
    tileChanged = new Map<SimTile, ITileChange>();
    width: number = 0;
    height: number = 0;
    constructor(readonly simCity: SimCity) { }

    setSize(width: number, height: number) {
        let tiles: SimTile[][] = [];
        for (let y = 0; y < height; y++) {
            let row = []
            for (let x = 0; x < width; x++) {
                let tile = new SimTile(this.simCity, x, y);
                row.push(tile);
            }
            tiles.push(row)
        }


        this.tiles = tiles;
        this.width = width;
        this.height = height;
    }

    feedRandom() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let floor: ModelName = 'road-four-way'; //(random(2) == 0 ? random(roads) : 'grass');
                //let building = null //random(residentialBuildings);
                this.getTile(x, y).setFloor(floor, random(4) * 90)
                //this.getTile(x, y).setBuilding(building, random(4) * 90)
            }
        }
    }

    getTileChanged(): ITileChange[] {
        let result = new Array(...this.tileChanged.values())
        return result;
    }

    getTile(x: number, y: number): SimTile {
        return this.tiles[y][x];
    }

}

export class SimTile {
    constructor(readonly city: SimCity, readonly x: number, readonly y: number) { }

    private getTileChange() {
        let tileChange = this.city.simTiles.tileChanged.get(this);
        if (!tileChange) {
            tileChange = { x: this.x, y: this.y };
            this.city.simTiles.tileChanged.set(this, tileChange);
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

