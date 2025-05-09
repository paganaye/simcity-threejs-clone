import { ModelName } from "../client/AssetManager";
import { ITileChange } from "./Init";

export class SimCity {
    tiles: SimTile[][] = [];
    tileChanged = new Map<SimTile, ITileChange>();
    width: number = 0;
    height: number = 0;

    setSize(width: number, height: number) {
        let tiles: SimTile[][] = [];
        for (let y = 0; y < height; y++) {
            let row = []
            for (let x = 0; x < width; x++) {
                let tile = new SimTile(this, x, y);
                row.push(tile);
            }
            tiles.push(row)
        }
        this.tiles = tiles;
        this.width = width;
        this.height = height;
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
        let tileChange = this.city.tileChanged.get(this);
        if (!tileChange) {
            tileChange = { x: this.x, y: this.y };
            this.city.tileChanged.set(this, tileChange);
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

