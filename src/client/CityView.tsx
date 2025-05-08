import * as THREE from 'three';
import { Tile } from './Tile';
import { GameScene } from './GameScene';
//import { BuildingType } from './buildings/buildingType.jsx';
//import { createBuilding } from './buildings/buildingFactory.jsx';
//import { VehicleGraph } from './vehicles/vehicleGraph.jsx';
//import { PowerService } from './services/power.jsx';
//import { Building } from './buildings/building.jsx';

export class CityView extends THREE.Group {
    /**
     * Separate group for organizing debug meshes so they aren't included
     * in raycasting checks
     * @type {THREE.Group}
     */
    debugMeshes = new THREE.Group();
    /**
     * Root node for all scene objects 
     * @type {THREE.Group}
     */
    root = new THREE.Group();
    /**
     * List of services for the city
     * @type {SimService}
     */
    //  services: PowerService[] = [];
    /**
     * The size of the city in tiles
     * @type {number}
     */
    size = 50;
    /**
     * The current simulation time
     */
    simTime = 0;

    simMoney = 999;
    /**
     * 2D array of tiles that make up the city
     * @type {Tile[][]}
     */
    #tiles: Tile[][] = [];
    /**
     * 
     * @param {VehicleGraph} size 
     */
    //  vehicleGraph: VehicleGraph | undefined;

    constructor() {
        super();
        //this.name = name;
        //this.size = size;
    }

    init(game: GameScene) {
        this.add(this.debugMeshes);
        this.add(this.root);

        this.#tiles = [];
        for (let y = 0; y < this.size; y++) {
            const row: Tile[] = [];
            for (let x = 0; x < this.size; x++) {
                const tile = new Tile(x, y);
                //tile.refreshView();
                this.root.add(tile);
                row.push(tile);
                tile.init(game);
            }
            this.#tiles.push(row);
        }

        //this.services = [];
        //this.services.push(new PowerService());

        //this.vehicleGraph = new VehicleGraph(this.size);
        //this.debugMeshes.add(this.vehicleGraph);
    }

    /**
     * The total population of the city
     * @type {number}
     */
    // get population() {
    //     let population = 0;
    //     for (let x = 0; x < this.size; x++) {
    //         for (let y = 0; y < this.size; y++) {
    //             const tile = this.getTile(x, y);
    //             if (tile?.building?.residents) population += tile.building.residents.count;
    //         }
    //     }
    //     return population;
    // }

    /** Returns the title at the coordinates. If the coordinates
     * are out of bounds, then `null` is returned.
     */
    getTile(x: number, y: number): Tile | null {
        if (x === undefined || y === undefined ||
            x < 0 || y < 0 ||
            x >= this.size || y >= this.size) {
            return null;
        } else {
            return this.#tiles[y][x];
        }
    }

    /**
     * Step the simulation forward by one step
     * @type {number} steps Number of steps to simulate forward in time
     */
    // simulate(steps = 1) {
    //     let count = 0;
    //     while (count++ < steps) {
    //         // Update services
    //         this.services.forEach((service) => service.simulate());

    //         // Update each building
    //         for (let x = 0; x < this.size; x++) {
    //             for (let y = 0; y < this.size; y++) {
    //                 this.getTile(x, y)!.simulate();
    //             }
    //         }
    //     }
    //     this.simTime++;
    // }



    //draw() {
    //    this.vehicleGraph?.updateVehicles();
    //}

    // /**
    //  * Finds the first tile where the criteria are true
    //  * @param {{x: number, y: number}} start The starting coordinates of the search
    //  * @param {(Tile) => (boolean)} filter This function is called on each
    //  * tile in the search field until `filter` returns true, or there are
    //  * no more tiles left to search.
    //  * @param {number} maxDistance The maximum distance to search from the starting tile
    //  */
    // findTile(start: { x: number, y: number }, filter: (tile: Tile) => boolean, maxDistance: number): Tile | null {
    //     const startTile = this.getTile(start.x, start.y);
    //     if (!startTile) return null;
    //     const visited = new Set();
    //     const tilesToSearch: Tile[] = [];

    //     // Initialze our search with the starting tile
    //     tilesToSearch.push(startTile);

    //     while (tilesToSearch.length > 0) {
    //         const tile = tilesToSearch.shift()!;
    //         // Has this tile been visited? If so, ignore it and move on
    //         if (visited.has(tile.id)) {
    //             continue;
    //         } else {
    //             visited.add(tile.id);
    //         }

    //         // Check if tile is outside the search bounds
    //         const distance = startTile.manhattanDistanceTo(tile);
    //         if (distance > maxDistance) continue;

    //         // Add this tiles neighbor's to the search list
    //         tilesToSearch.push(...this.getTileNeighbors(tile.x, tile.y));

    //         // If this tile passes the criteria 
    //         if (filter(tile)) {
    //             return tile;
    //         }
    //     }

    //     return null;
    // }

    // /**
    //  * Finds and returns the neighbors of this tile
    //  * @param {number} x The x-coordinate of the tile
    //  * @param {number} y The y-coordinate of the tile
    //  */
    // getTileNeighbors(x: number, y: number) {
    //     const neighbors: Tile[] = [];

    //     if (x > 0) {
    //         neighbors.push(this.getTile(x - 1, y)!);
    //     }
    //     if (x < this.size - 1) {
    //         neighbors.push(this.getTile(x + 1, y)!);
    //     }
    //     if (y > 0) {
    //         neighbors.push(this.getTile(x, y - 1)!);
    //     }
    //     if (y < this.size - 1) {
    //         neighbors.push(this.getTile(x, y + 1)!);
    //     }

    //     return neighbors;
    // }
}