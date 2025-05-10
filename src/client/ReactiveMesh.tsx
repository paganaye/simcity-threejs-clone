import { AssetManager, IFastMesh, ModelName } from './AssetManager';

export class ReactiveMesh {
  #modelName: ModelName | null = null;
  fastMesh?: IFastMesh;


  set(assets: AssetManager, modelName: ModelName | null, x: number, y: number, z: number, rotation: number) {
    if (modelName != this.#modelName) {
      if (this.#modelName) this.clear(assets);
      if (modelName) {
        this.fastMesh = assets.addFastMesh(modelName, x, y, z, rotation);
      }
    } else if (this.fastMesh) {
      assets.moveFastMesh(this.fastMesh!, x, y, z, rotation);
    }
  }

  move(assets: AssetManager, x: number, y: number, z: number, rotation?: number) {
    if (this.fastMesh) assets.moveFastMesh(this.fastMesh, x, y, z, rotation);
  }

  clear(assets: AssetManager) {
    if (this.#modelName) {
      this.#modelName = null;
      if (this.fastMesh) assets.removeFastMesh(this.fastMesh);
    }
  }
}
