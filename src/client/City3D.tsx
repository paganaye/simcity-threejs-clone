import * as THREE from 'three';
import { Tile3D } from './Tile3D';
import { Game3D } from './Game3D';
import { ITileChange } from '../sim/SimTiles';

//import { BuildingType } from './buildings/buildingType.jsx';
//import { createBuilding } from './buildings/buildingFactory.jsx';
//import { VehicleGraph } from './vehicles/vehicleGraph.jsx';
//import { PowerService } from './services/power.jsx';
//import { Building } from './buildings/building.jsx';

export class City3D {
    setSize(width: number, height: number) {
        if (width != this.width || height != this.height) {
            this.width = width;
            this.height = height;
            this.initTiles();
        }
    }

    clearCity() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // let tile = this.getTile({ x, y })!;
                // tile.floor.set('grass', 0)
                // tile?.building.clear();
            }
        }
    }

    root = new THREE.Group();
    width = 0;
    height = 0;
    simTime = 0;
    simMoney = 999;
    #tiles: Tile3D[][] = [];

    constructor(readonly game: Game3D) {
    }

    drawFrame(_delta: number) {
    }


    init() {
        this.initTiles();
    }

    initTiles() {
        this.root.clear();
        this.#tiles = [];
        for (let y = 0; y < this.height; y++) {
            const row: Tile3D[] = [];
            for (let x = 0; x < this.width; x++) {
                const tile = new Tile3D(x, y);
                row.push(tile);
            }
            this.#tiles.push(row);
        }
    }

    getTile({ x, y }: { x: number, y: number }): Tile3D {

        if (x === undefined || y === undefined ||
            x < 0 || y < 0 ||
            x >= this.width || y >= this.height) {
            throw Error(`Invalid tile ${x} ${y}`)
        } else {
            return this.#tiles[y][x];
        }
    }

    onTileChanged(tileChanged: ITileChange[]) {
        for (let t of tileChanged) {
            let tile = this.getTile(t)
            tile?.floor.set(this.game, t.floor ?? null, tile.x, tile.y, 0, t.orientation ?? 0);
            tile?.building.set(this.game, t.building ?? null, tile.x, tile.y, 0, t.buildingOrientation ?? 0);
        }
        Object.values(this.game.assetManager.fastMeshes).forEach(m => {
            m.instancedMesh.instanceMatrix.needsUpdate = true;
        })
    }

}