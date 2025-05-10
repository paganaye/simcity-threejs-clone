import * as THREE from 'three';
import { JSXElement } from 'solid-js';
import { Scene3D } from './Scene3D.js';
import { ReactiveMesh } from './ReactiveMesh.jsx';
import { ICarInfo, ICarPath } from '../sim/SimCars.js';

const RAD2DEG = THREE.MathUtils.RAD2DEG;

export class Car3D {

  readonly car = new ReactiveMesh();

  pathIndex: number = 0;
  path!: ICarPath[];
  speed: number = 0;
  rotation: number = 0;
  pos = { x: 0, z: 0 };
  currentTarget = { x: 0, z: 0 };
  static minSpeed = 0.1;
  static maxSpeed = 1;
  static acceleration = 1;
  static deceleration = 1;
  static turnSpeed = 6;
  static turnDistance = 0.25;
  static breakDistance = 0.35;
  drawFrame(scene: Scene3D, delta: number) {
    delta /= 10_000;
    let dot = this.dot();

    let nextPath = () => {
      if (this.path.length < 2) return;
      this.pathIndex = (this.pathIndex + 1) % this.path.length;
      this.currentTarget = this.path[this.pathIndex];
    }

    if (dot < -2 || dot > 2) {
      // something is wrong teleport and fast recover
      this.pos = { x: this.path[this.pathIndex].x, z: this.path[this.pathIndex].z };
      this.speed = 0;
      this.pathIndex = (this.pathIndex + 1) % this.path.length;
      this.currentTarget = this.path[this.pathIndex];
      this.rotation = Math.atan2(this.currentTarget.z - this.pos.z, this.currentTarget.x - this.pos.x);
      dot = this.dot();
    }
    if (dot > 0 && dot < Car3D.turnDistance) {
      nextPath();
      dot = this.dot();

    }

    const targetAngle = Math.atan2(this.currentTarget.z - this.pos.z, this.currentTarget.x - this.pos.x) * RAD2DEG;
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
    this.pos.z += Math.sin(this.rotation) * this.speed * delta;

    this.car.move(scene.assetManager, this.pos.x, 0.0, this.pos.z, -this.rotation);
  }

  distanceTo(to: { x: number, y: number }) {
    return Math.abs(this.pos.x - to.x) + Math.abs(this.pos.z - to.y);
  }

  dot() {
    const dx = this.currentTarget.x - this.pos.x;
    const dy = this.currentTarget.z - this.pos.z;
    const dot = dx * Math.cos(this.rotation) + dy * Math.sin(this.rotation);
    return dot;
  }

  static normalizeAngle(a: number): number {
    if (a > 180) a -= 360;
    else if (a < -180) a += 360;
    return a;
  }



  constructor(scene: Scene3D, readonly carInfo: ICarInfo) {
    this.car.set(scene.assetManager, carInfo.model, 0, 0, 0, 0);
    this.path = this.carInfo.path;
    if (this.path && this.path.length) {
      let start = this.path[0]
      this.pos = { x: start.x, z: start.z };
      this.currentTarget = this.path[1];

    }
  }


  toHTML(): JSXElement {
    return <>

    </>;
  }
};
