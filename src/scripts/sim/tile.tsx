import { Building } from './buildings/building.js';
import { SimObject } from './simObject.js';
import { assetManager } from '../../App.jsx';
import { JSXElement } from 'solid-js';

export class Tile extends SimObject {
  /**
   * The type of terrain
   * @type {string}
   */
  terrain = 'grass';
  /**
   * The building on this tile
   * @type {Building?}
   */
  #building: Building | null = null;

  constructor(x: number, y: number) {
    super(x, y);
    this.name = `Tile-${this.x}-${this.y}`;
  }

  /**
   * @type {Building}
   */
  get building(): Building | null {
    return this.#building;
  }

  /**
   * @type {Building} value
   */
  setBuilding(value: Building | null) {
    // Remove and dispose resources for existing building
    if (this.#building) {
      this.#building.dispose();
      this.remove(this.#building);
    }

    this.#building = value;

    // Add to scene graph
    if (value) {
      this.add(value);
    }
  }

  refreshView() {
    this.building?.refreshView();
    if (this.building?.hideTerrain) {
      this.setMesh(null);
    } else {
      /**
       * @type {THREE.Mesh}
       */
      const mesh = assetManager.getModel(this.terrain, this);
      mesh.name = this.terrain;
      this.setMesh(mesh);
    }
  }

  simulate() {
    this.building?.simulate();
  }

  /**
   * Gets the Manhattan distance between two tiles
   * @param {Tile} tile 
   * @returns 
   */
  distanceTo(tile: Tile) {
    return Math.abs(this.x - tile.x) + Math.abs(this.y - tile.y);
  }

  /**
   * 
   * @returns {string} HTML representation of this object
   */
  toHTML(): JSXElement {
    return <>
      <div class="info-heading">Tile</div>
      <span class="info-label">Coordinates </span>
      <span class="info-value">X: {this.x}, Y: {this.y}</span>
      <br />
      <span class="info-label">Terrain </span>
      <span class="info-value">{this.terrain}</span>
      <br />
      {this.building?.toHTML()}
    </>;
  }
};