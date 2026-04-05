import { AssetManager } from "../AssetManager";
import type { CharacterDebugView } from "../Character";
import { Page } from "../Page";
import { Crowd3D } from "../Crowd3D";
import { Character } from "../Character";

export default class Path2 extends Page {
  private crowd3D?: Crowd3D;
  private characterDebugView?: CharacterDebugView;

  async run() {
    this.crowd3D = new Crowd3D(this.scene);
    this.crowd3D.init(40, 40, {
      count: 300,
      childRatio: 0.18,
    });
    this.setupTargets();
    // setupTargets rewrites character positions after init(), so resync quadtree.
    this.crowd3D.population.setupQuadTree(this.crowd3D.population.mapWidth, this.crowd3D.population.mapHeight);

    this.camera.position.set(10, 20, -5);
    if (this.controls) {
      this.controls.target.set(10, 0, 15);
      this.controls.update();
    }

    const assetManager = new AssetManager({ scene: this.scene } as any);
    await assetManager.init();

    this.characterDebugView = Character.createDebugView(this.scene, this.crowd3D.population.characters.length);
    Character.updateDebugView(this.characterDebugView, this.crowd3D.population.characters);

    // for (const { modelName, x, z } of BUILDINGS) {
    //   assetManager.addFastMesh(modelName, x, 0, z, 0);
    // }

  }

  private randomPoint(): { x: number; z: number } {
    if (!this.crowd3D) {
      return { x: 0, z: 0 };
    }

    const maxX = this.crowd3D.population.mapWidth - 1;
    const maxZ = this.crowd3D.population.mapHeight - 1;
    return {
      x: Math.random() * maxX,
      z: Math.random() * maxZ,
    };
  }

  private setupTargets(): void {
    if (!this.crowd3D) {
      return;
    }

    for (const character of this.crowd3D.population.characters) {
      const start = this.randomPoint();
      let target = this.randomPoint();
      while ((target.x - start.x) * (target.x - start.x) + (target.z - start.z) * (target.z - start.z) < 1) {
        target = this.randomPoint();
      }

      character.x = start.x;
      character.z = start.z;
      character.heading = Math.atan2(target.x - start.x, target.z - start.z);
      character.setTarget(target);
    }
  }

  private updateTargets(): void {
    if (!this.crowd3D) {
      return;
    }

    for (const character of this.crowd3D.population.characters) {
      const goal = character.goalTarget;
      if (!goal) {
        character.setTarget(this.randomPoint());
        continue;
      }

      const dx = goal.x - character.x;
      const dz = goal.z - character.z;
      if (dx * dx + dz * dz < 0.05) {
        character.setTarget(this.randomPoint());
      }
    }
  }

  override loop(elapsed: number): void {
    this.updateTargets();
    this.crowd3D?.tick(elapsed);
    if (this.crowd3D) {
      Character.updateDebugView(this.characterDebugView, this.crowd3D.population.characters);
    }
  }

  override cleanup(): void {
    Character.disposeDebugView(this.scene, this.characterDebugView);
    this.characterDebugView = undefined;
    this.crowd3D?.dispose();
    this.crowd3D = undefined;
  }
}
