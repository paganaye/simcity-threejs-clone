import { JSXElement } from 'solid-js';
import { Game3D } from './Game3D.js';
import { MeshSignal } from './MeshSignal.jsx';
import { ICarInfo, ICarPath } from '../sim/SimCars.js';
import { manhattanDistance } from '../sim/IPoint.js';


export class Car3D {

  readonly car = new MeshSignal();

  pathIndex: number = 0;
  path!: ICarPath[];
  speed: number = 0;
  rotation: number = 0;
  pos = { x: 0, y: 0 };
  currentTarget = { x: 0, y: 0 };
  static minSpeed = 0.1;
  static maxSpeed = 1;
  static acceleration = 1;
  static deceleration = 1;
  static turnSpeed = 6;
  static turnDistance = 0.25;
  static breakDistance = 0.35;
  drawFrame(game: Game3D, delta: number) {
    delta /= 10_000;
    let dot = this.dot();

    let nextPath = () => {
      if (this.path.length < 2) return;
      let previousTarget = this.currentTarget;
      this.pathIndex = (this.pathIndex + 1) % this.path.length;
      this.currentTarget = this.path[this.pathIndex];
      if (manhattanDistance(previousTarget, this.currentTarget) == 0) {
        nextPath();
      }
    }

    if (dot < -2 || dot > 2) {
      // something is wrong teleport and fast recover
      this.pos = { x: this.path[this.pathIndex].x, y: this.path[this.pathIndex].y };
      this.speed = 0;
      this.pathIndex = (this.pathIndex + 1) % this.path.length;
      this.currentTarget = this.path[this.pathIndex];
      this.rotation = Math.atan2(this.currentTarget.y - this.pos.y, this.currentTarget.x - this.pos.x);
      dot = this.dot();
    }
    if (dot > 0 && dot < Car3D.turnDistance) {
      nextPath();
      dot = this.dot();

    }

    const targetAngle = Math.atan2(this.currentTarget.y - this.pos.y, this.currentTarget.x - this.pos.x);
    let angleDiff = Car3D.normalizeAngle(targetAngle - this.rotation);
    this.rotation += angleDiff * Car3D.turnSpeed * delta;


    if (dot < 0) {
      this.rotation = targetAngle;
      this.speed = 0;
    } else if (dot < Car3D.breakDistance) {
      this.speed = Math.max(Car3D.minSpeed, this.speed * (1 - delta * Car3D.deceleration), 0);
    } else {
      this.speed = Math.min(this.speed + Car3D.acceleration * delta, Car3D.maxSpeed);
    }

    this.pos.x += Math.cos(this.rotation) * this.speed * delta;
    this.pos.y += Math.sin(this.rotation) * this.speed * delta;

    this.car.move(game, this.pos.x, this.pos.y, 0, -this.rotation);
  }

  distanceTo(to: { x: number, y: number }) {
    return Math.abs(this.pos.x - to.x) + Math.abs(this.pos.y - to.y);
  }

  dot() {
    const dx = this.currentTarget.x - this.pos.x;
    const dy = this.currentTarget.y - this.pos.y;
    const dot = dx * Math.cos(this.rotation) + dy * Math.sin(this.rotation);
    return dot;
  }

  static normalizeAngle(a: number): number {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }



  constructor(game: Game3D, readonly carInfo: ICarInfo) {
    this.car.set(game, carInfo.model, 0, 0, 0, 0);
    this.path = this.carInfo.path;

  }


  toHTML(): JSXElement {
    return <>

    </>;
  }
};

// function lerp(p: number, from: number, to: number) {
//   return (1 - p) * from + p * to;
// }

// function lerpAngle(p: number, from: number, to: number): number {
//   let diff = ((to - from + Math.PI) % (2 * Math.PI)) - Math.PI;
//   return from + diff * p;
// }

