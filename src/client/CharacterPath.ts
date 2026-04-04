import * as THREE from "three";
import { rotateTowards } from "./Character";

export type CharacterPathPoint = { x: number; y: number };
export type CharacterCellToWorld = (x: number, y: number) => THREE.Vector3;

export type CharacterPathUpdate = {
  position: THREE.Vector3;
  heading: number;
  isWalking: boolean;
  reachedEnd: boolean;
};

export class CharacterPath {
  private path: CharacterPathPoint[] = [];
  private nextWaypoint = 1;
  private speed = 1.4;
  private turnSpeed = 8;
  private arrivalRadius = 0.08;
  private lookAheadDistance = 0.4;
  private heading = 0;
  private readonly position = new THREE.Vector3();

  constructor(options?: {
    speed?: number;
    turnSpeed?: number;
    arrivalRadius?: number;
    lookAheadDistance?: number;
  }) {
    if (!options) {
      return;
    }
    if (options.speed !== undefined) {
      this.speed = options.speed;
    }
    if (options.turnSpeed !== undefined) {
      this.turnSpeed = options.turnSpeed;
    }
    if (options.arrivalRadius !== undefined) {
      this.arrivalRadius = options.arrivalRadius;
    }
    if (options.lookAheadDistance !== undefined) {
      this.lookAheadDistance = options.lookAheadDistance;
    }
  }

  setPath(path: CharacterPathPoint[], cellToWorld: CharacterCellToWorld): CharacterPathUpdate {
    this.path = path;
    this.nextWaypoint = Math.min(1, path.length - 1);

    const startCell = path[0];
    if (startCell) {
      this.position.copy(cellToWorld(startCell.x, startCell.y));
    }

    if (path.length > 1) {
      const current = this.position;
      const next = cellToWorld(path[1].x, path[1].y);
      this.heading = Math.atan2(next.x - current.x, next.z - current.z);
    }

    return {
      position: this.position,
      heading: this.heading,
      isWalking: path.length > 1,
      reachedEnd: path.length <= 1,
    };
  }

  update(delta: number, cellToWorld: CharacterCellToWorld): CharacterPathUpdate {
    if (delta <= 0 || this.path.length < 2 || this.nextWaypoint >= this.path.length) {
      return {
        position: this.position,
        heading: this.heading,
        isWalking: false,
        reachedEnd: this.nextWaypoint >= this.path.length || this.path.length < 2,
      };
    }

    while (this.nextWaypoint < this.path.length) {
      const currentTargetCell = this.path[this.nextWaypoint];
      const currentTarget = cellToWorld(currentTargetCell.x, currentTargetCell.y);
      const dx = currentTarget.x - this.position.x;
      const dz = currentTarget.z - this.position.z;
      const distance = Math.hypot(dx, dz);

      if (distance > this.arrivalRadius) {
        const nextCell = this.path[this.nextWaypoint + 1];
        let desiredHeading = Math.atan2(dx, dz);

        if (nextCell) {
          const nextTarget = cellToWorld(nextCell.x, nextCell.y);
          const blend = THREE.MathUtils.clamp((this.lookAheadDistance - distance) / this.lookAheadDistance, 0, 1);
          const aimX = THREE.MathUtils.lerp(currentTarget.x, nextTarget.x, blend);
          const aimZ = THREE.MathUtils.lerp(currentTarget.z, nextTarget.z, blend);
          desiredHeading = Math.atan2(aimX - this.position.x, aimZ - this.position.z);
        }

        this.heading = rotateTowards(this.heading, desiredHeading, this.turnSpeed * delta);

        const step = this.speed * delta;
        if (step >= distance) {
          this.position.copy(currentTarget);
          this.nextWaypoint += 1;
        } else {
          const inv = 1 / distance;
          this.position.x += dx * inv * step;
          this.position.z += dz * inv * step;
        }

        return {
          position: this.position,
          heading: this.heading,
          isWalking: true,
          reachedEnd: false,
        };
      }

      this.position.copy(currentTarget);
      this.nextWaypoint += 1;
    }

    return {
      position: this.position,
      heading: this.heading,
      isWalking: false,
      reachedEnd: true,
    };
  }
}
