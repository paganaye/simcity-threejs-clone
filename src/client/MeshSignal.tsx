import { IFastMesh, ModelName } from './AssetManager';
import { Game3D } from './Game3D';



export class MeshSignal {
  #modelName: ModelName | null = null;
  fastMesh?: IFastMesh;


  set(game: Game3D, modelName: ModelName | null, x: number, y: number, z: number, rotation: number) {
    if (modelName != this.#modelName) {
      if (this.#modelName) this.clear();
      if (modelName) {
        this.fastMesh = game.assetManager.addFastMesh(modelName, x, y, z, rotation);
      }
    }
  }

  deltaMove(game: Game3D, dx: number, dy: number) {
    if (this.fastMesh) game.assetManager.deltaMoveFastMesh(this.fastMesh, dx, dy);
  }

  move(game: Game3D, dx: number, dy: number, dz: number, rotation?: number) {
    if (this.fastMesh) game.assetManager.moveFastMesh(this.fastMesh, dx, dy, dz, rotation);
  }


  clear() {
    if (this.#modelName) {
      this.#modelName = null;
      //TODO remove
    }
  }
}
