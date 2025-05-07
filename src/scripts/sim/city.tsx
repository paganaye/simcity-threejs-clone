import * as THREE from 'three';
import { BuildingType } from './buildings/buildingType.js';
import { createBuilding } from './buildings/buildingFactory.js';
import { Tile } from './tile.js';
import { VehicleGraph } from './vehicles/vehicleGraph.js';
import { PowerService } from './services/power.js';

export class City extends THREE.Group {
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
  services: PowerService[] = [];
  /**
   * The size of the city in tiles
   * @type {number}
   */
  size = 16;
  /**
   * The current simulation time
   */
  simTime = 0;
  /**
   * 2D array of tiles that make up the city
   * @type {Tile[][]}
   */
  tiles: Tile[][] = [];
  /**
   * 
   * @param {VehicleGraph} size 
   */
  vehicleGraph: VehicleGraph | undefined;

  constructor() {
    super();
  }
  init(size: number, name = 'My City') {
    this.name = name;
    this.size = size;

    this.add(this.debugMeshes);
    this.add(this.root);

    this.tiles = [];
    for (let x = 0; x < this.size; x++) {
      const column: Tile[] = [];
      for (let y = 0; y < this.size; y++) {
        const tile = new Tile(x, y);
        tile.refreshView(this);
        this.root.add(tile);
        column.push(tile);
      }
      this.tiles.push(column);
    }

    this.services = [];
    this.services.push(new PowerService());

    this.vehicleGraph = new VehicleGraph(this.size);
    this.debugMeshes.add(this.vehicleGraph);
  }

  /**
   * The total population of the city
   * @type {number}
   */
  get population() {
    let population = 0;
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.getTile(x, y);
        if (tile?.building?.residents) population += tile.building.residents.count;
      }
    }
    return population;
  }

  /** Returns the title at the coordinates. If the coordinates
   * are out of bounds, then `null` is returned.
   */
  getTile(x: number, y: number): Tile | null {
    if (x === undefined || y === undefined ||
      x < 0 || y < 0 ||
      x >= this.size || y >= this.size) {
      return null;
    } else {
      return this.tiles[x][y];
    }
  }

  /**
   * Step the simulation forward by one step
   * @type {number} steps Number of steps to simulate forward in time
   */
  simulate(steps = 1) {
    let count = 0;
    while (count++ < steps) {
      // Update services
      this.services.forEach((service) => service.simulate(this));

      // Update each building
      for (let x = 0; x < this.size; x++) {
        for (let y = 0; y < this.size; y++) {
          this.getTile(x, y)!.simulate(this);
        }
      }
    }
    this.simTime++;
  }

  /**
   * Places a building at the specified coordinates if the
   * tile does not already have a building on it
   * @param {number} x 
   * @param {number} y 
   * @param {string} buildingType 
   */
  placeBuilding(x: number, y: number, buildingType: string) {
    const tile = this.getTile(x, y);

    // If the tile doesnt' already have a building, place one there
    if (tile && !tile.building) {
      let newBuilding = createBuilding(x, y, buildingType)!
      tile.setBuilding(newBuilding);
      tile.refreshView(this);

      // Update buildings on adjacent tile in case they need to
      // change their mesh (e.g. roads)
      this.getTile(x - 1, y)?.refreshView(this);
      this.getTile(x + 1, y)?.refreshView(this);
      this.getTile(x, y - 1)?.refreshView(this);
      this.getTile(x, y + 1)?.refreshView(this);

      if (newBuilding.type === BuildingType.road) {
        this.vehicleGraph?.updateTile(x, y, tile.building);
      }
    }
  }

  /**
   * Bulldozes the building at the specified coordinates
   * @param {number} x 
   * @param {number} y
   */
  bulldoze(x: number, y: number) {
    const tile = this.getTile(x, y);

    if (tile && tile.building) {
      if (tile.building.type === BuildingType.road) {
        this.vehicleGraph?.updateTile(x, y, null);
      }

      tile.building.dispose();
      tile.setBuilding(null);
      tile.refreshView(this);

      // Update neighboring tiles in case they need to change their mesh (e.g. roads)
      this.getTile(x - 1, y)?.refreshView(this);
      this.getTile(x + 1, y)?.refreshView(this);
      this.getTile(x, y - 1)?.refreshView(this);
      this.getTile(x, y + 1)?.refreshView(this);
    }
  }

  draw() {
    this.vehicleGraph?.updateVehicles();
  }

  /**
   * Finds the first tile where the criteria are true
   * @param {{x: number, y: number}} start The starting coordinates of the search
   * @param {(Tile) => (boolean)} filter This function is called on each
   * tile in the search field until `filter` returns true, or there are
   * no more tiles left to search.
   * @param {number} maxDistance The maximum distance to search from the starting tile
   */
  findTile(start: { x: number, y: number }, filter: (tile: Tile) => boolean, maxDistance: number): Tile | null {
    const startTile = this.getTile(start.x, start.y);
    if (!startTile) return null;
    const visited = new Set();
    const tilesToSearch: Tile[] = [];

    // Initialze our search with the starting tile
    tilesToSearch.push(startTile);

    while (tilesToSearch.length > 0) {
      const tile = tilesToSearch.shift()!;
      // Has this tile been visited? If so, ignore it and move on
      if (visited.has(tile.id)) {
        continue;
      } else {
        visited.add(tile.id);
      }

      // Check if tile is outside the search bounds
      const distance = startTile.distanceTo(tile);
      if (distance > maxDistance) continue;

      // Add this tiles neighbor's to the search list
      tilesToSearch.push(...this.getTileNeighbors(tile.x, tile.y));

      // If this tile passes the criteria 
      if (filter(tile)) {
        return tile;
      }
    }

    return null;
  }

  /**
   * Finds and returns the neighbors of this tile
   * @param {number} x The x-coordinate of the tile
   * @param {number} y The y-coordinate of the tile
   */
  getTileNeighbors(x: number, y: number) {
    const neighbors: Tile[] = [];

    if (x > 0) {
      neighbors.push(this.getTile(x - 1, y)!);
    }
    if (x < this.size - 1) {
      neighbors.push(this.getTile(x + 1, y)!);
    }
    if (y > 0) {
      neighbors.push(this.getTile(x, y - 1)!);
    }
    if (y < this.size - 1) {
      neighbors.push(this.getTile(x, y + 1)!);
    }

    return neighbors;
  }
}