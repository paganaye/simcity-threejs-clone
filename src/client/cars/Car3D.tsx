import { GameScene3D } from '../GameScene3D.js';
import { ReactiveMesh } from '../ReactiveMesh.jsx';
import { IPoint2D } from '../../sim/Geometry.js';
import { ICarInfo } from '../../sim/SimCars.js';
import { CarState } from './CarStates';



export class Car3D implements IPoint2D {
  readonly carMesh = new ReactiveMesh();
  x: number = 0;
  z: number = 0;
  rotation: number = 0; // in radian
  speed: number = 0;

  // The current state instance of the car
  currentCarState: CarState;


  constructor(readonly scene: GameScene3D, readonly carInfo: ICarInfo) {
    this.carMesh.set(scene.assetManager, (carInfo as any).model, 0, 0, 0, 0);
    this.currentCarState = CarState.createInitialState(this);
    this.currentCarState.initialize(this, performance.now());
  }

  private updateCarVisuals(scene: GameScene3D): void {
    this.carMesh.move(scene.assetManager, this.x, 0, this.z, -this.rotation);
  }

  drawFrame(scene: GameScene3D, now: number) {
    this.currentCarState.onDrawFrame(this, now);
    this.updateCarVisuals(scene);
  }


}