import * as THREE from 'three';
import { JSXElement } from 'solid-js';
import { SimObject3D } from './SimObject3D.jsx';
import { Game3D } from './Game3D.js';
import { ModelName } from './AssetManager.js';


export class MeshSignal {
  #mesh: THREE.Mesh | null = null;
  #modelName: ModelName | null = null;
  //#_rotation?: number | null;

  constructor(readonly owner: Tile) { }

  set(modelName: ModelName | null, _orientation: number = 0) {
    let scene = this.owner.scene;
    if (modelName != this.#modelName) {
      if (this.#modelName) this.clear();
      if (modelName) {
        scene.assetManager.addFastMesh(modelName, this.owner.x, this.owner.y, 0)
      }
    }
  }

  clear() {
    if (this.#mesh) {
      this.owner.remove(this.#mesh);
      this.#mesh = null;
      this.#modelName = null;
      //this.#_rotation = null;
    }
  }
}

export class Tile extends SimObject3D {

  readonly floor = new MeshSignal(this);
  readonly building = new MeshSignal(this);


  constructor(scene: Game3D, readonly x: number, readonly y: number) {
    super(scene, x, y);
    this.name = `Tile-${this.x}-${this.y}`;

  }



  toHTML(): JSXElement {
    return <>
      <div class="info-heading">Tile</div>
      <span class="info-label">Coordinates </span>
      <span class="info-value">X: {this.x}, Y: {this.y}</span>
      <br />
      <span class="info-label">Terrain </span>
      {/*<span class="info-value">{this.terrain}</span>*/}
      <br />
      {/* {this.building?.toHTML()} */}
    </>;
  }
};