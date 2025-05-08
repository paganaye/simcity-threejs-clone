import * as THREE from 'three';
import { Accessor, createSignal, JSXElement, Setter } from 'solid-js';
import { SimObject } from './SimObject.jsx';
import { GameScene } from './GameScene.js';
import { ModelName } from './AssetManager.js';
//import { Accessor, createSignal, JSXElement, Setter } from 'solid-js';

export class Tile extends SimObject {
  terrain: ModelName = 'grass';
  private _getBuilding: Accessor<ModelName | null>;
  private _setBuilding: Setter<ModelName | null>;


  constructor(readonly x: number, readonly y: number) {
    super(x, y);
    this.name = `Tile-${this.x}-${this.y}`;
    [this._getBuilding, this._setBuilding] = createSignal<ModelName | null>(null);

  }

  init(game: GameScene) {
    this.#createTerrainView(game);
  }

  get building(): ModelName | null {
    return this._getBuilding();
  }

  _buildingMesh?: THREE.Mesh | null;

  setBuilding(scene: GameScene, modelName: ModelName | null) {
    if (this._buildingMesh) {
      this.remove(this._buildingMesh);
    }
    if (modelName) {
      let mesh = scene.assetManager.getModel(modelName, undefined, true);
      this.add(mesh)
      this._buildingMesh = mesh;

    }
    this._setBuilding(modelName);
  }


  #createTerrainView(game: GameScene) {
    //   if (this.building?.hideTerrain) {
    //     this.setMesh(null);
    //   } else {
    const mesh = game.assetManager.getModel(this.terrain, this);
    mesh.name = this.terrain;
    this.setMesh(mesh);
    // }
  }

  // simulate() {
  //   this.building?.simulate();
  // }

  manhattanDistanceTo(tile: Tile) {
    return Math.abs(this.x - tile.x) + Math.abs(this.y - tile.y);
  }

  toHTML(): JSXElement {
    return <>
      <div class="info-heading">Tile</div>
      <span class="info-label">Coordinates </span>
      <span class="info-value">X: {this.x}, Y: {this.y}</span>
      <br />
      <span class="info-label">Terrain </span>
      <span class="info-value">{this.terrain}</span>
      <br />
      {/* {this.building?.toHTML()} */}
    </>;
  }
};