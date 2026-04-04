import { AssetManager } from "../AssetManager";
import { Page } from "../Page";
import { Crowd3D } from "../Crowd3D";
import { Character, CharacterOccupancyMesh } from "../Character";
import { rotateTowards } from "../../sim/utils";

export default class Path2 extends Page {
  private crowd3D?: Crowd3D;
  private readonly patrolTargets = new Map<Character, { ax: number; az: number; bx: number; bz: number; toB: boolean }>();
  private occupancyMesh?: CharacterOccupancyMesh;
  private lastElapsed = 0;
  private readonly patrolTurnSpeed = 2.2;

  async run() {
    this.crowd3D = new Crowd3D(this.scene);
    this.crowd3D.init(8, 8, {
      count: 10,
      childRatio: 0.18,
      walkingRatio: 0.7,
    });
    this.setupPatrols();
    // setupPatrols rewrites character positions after init(), so resync quadtree.
    this.crowd3D.population.setupQuadTree(this.crowd3D.population.mapWidth, this.crowd3D.population.mapHeight);

    this.camera.position.set(10, 20, -5);
    if (this.controls) {
      this.controls.target.set(10, 0, 15);
      this.controls.update();
    }

    const assetManager = new AssetManager({ scene: this.scene } as any);
    await assetManager.init();

    this.occupancyMesh = new CharacterOccupancyMesh(this.scene);
    this.occupancyMesh.init(this.crowd3D.population.characters.length);
    this.occupancyMesh.update(this.crowd3D.population.characters);

    // for (const { modelName, x, z } of BUILDINGS) {
    //   assetManager.addFastMesh(modelName, x, 0, z, 0);
    // }

  }
  private setupPatrols(): void {
    if (!this.crowd3D) {
      return;
    }

    const maxX = this.crowd3D.population.mapWidth - 1;
    const maxZ = this.crowd3D.population.mapHeight - 1;
    const randomPoint = () => ({
      x: Math.random() * maxX,
      z: Math.random() * maxZ,
    });

    for (const character of this.crowd3D.population.characters) {
      const a = randomPoint();
      let b = randomPoint();
      while ((b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z) < 1) {
        b = randomPoint();
      }

      character.x = a.x;
      character.z = a.z;
      character.heading = Math.atan2(b.x - a.x, b.z - a.z);
      this.patrolTargets.set(character, { ax: a.x, az: a.z, bx: b.x, bz: b.z, toB: true });
    }
  }

  private updatePatrolHeadings(delta: number): void {
    if (!this.crowd3D) {
      return;
    }

    for (const character of this.crowd3D.population.characters) {
      const patrol = this.patrolTargets.get(character);
      if (!patrol) {
        continue;
      }

      let tx = patrol.toB ? patrol.bx : patrol.ax;
      let tz = patrol.toB ? patrol.bz : patrol.az;
      let dx = tx - character.x;
      let dz = tz - character.z;

      if (dx * dx + dz * dz < 0.04) {
        patrol.toB = !patrol.toB;
        tx = patrol.toB ? patrol.bx : patrol.ax;
        tz = patrol.toB ? patrol.bz : patrol.az;
        dx = tx - character.x;
        dz = tz - character.z;
      }

      const desiredHeading = Math.atan2(dx, dz);
      character.heading = rotateTowards(character.heading, desiredHeading, this.patrolTurnSpeed * delta);
    }
  }

  override loop(elapsed: number): void {
    const delta = this.lastElapsed === 0 ? 0 : elapsed - this.lastElapsed;
    this.lastElapsed = elapsed;
    if (delta > 0) {
      this.updatePatrolHeadings(delta);
    }
    this.crowd3D?.tick(elapsed);
    if (this.crowd3D) {
      this.occupancyMesh?.update(this.crowd3D.population.characters);
    }
  }

  override cleanup(): void {
    this.occupancyMesh?.dispose();
    this.occupancyMesh = undefined;
    this.crowd3D?.dispose();
    this.crowd3D = undefined;
    this.patrolTargets.clear();
    this.lastElapsed = 0;
  }
}
