import { IFastMesh, ModelName } from './AssetManager';
import { JSXElement } from 'solid-js';
import { Scene3D } from './Scene3D';
//import { MeshSignal } from './MeshSignal.jsx';


export class Tile3D {
  _floor?: IFastMesh;
  _building?: IFastMesh;

  constructor(readonly x: number, readonly z: number) {

  }

  setFloor(scene: Scene3D, floor: ModelName | undefined, orientation: number | undefined) {
    this._floor = this.#setAsset(scene, this._floor, floor, orientation);
  }
  setContent(scene: Scene3D, building: ModelName | undefined, buildingOrientation: number | undefined) {
    this._building = this.#setAsset(scene, this._building, building, buildingOrientation);
  }

  #setAsset(scene: Scene3D, mesh: IFastMesh | undefined, model: ModelName | undefined, rotation: number | undefined): IFastMesh | undefined {
    if (mesh?.parent.modelName != model) {
      if (mesh) scene.assetManager.removeFastMesh(mesh);
      if (model) mesh = scene.assetManager.addFastMesh(model, this.x, 0.0, this.z, rotation ?? 0)
    }
    if (mesh && rotation != mesh.rotation) {
      scene.assetManager.moveFastMesh(mesh, this.x, 0.0, this.z, rotation);
    }
    return mesh;
  }



  toHTML(): JSXElement {
    return <>
      <div class="info-heading">Tile</div>
      <span class="info-label">Coordinates </span>
      <span class="info-value">X: {this.x}, Z: {this.z}</span>
      <br />
      <span class="info-label">Terrain </span>
      {/*<span class="info-value">{this.terrain}</span>*/}
      <br />
      {/* {this.building?.toHTML()} */}
    </>;
  }
};



