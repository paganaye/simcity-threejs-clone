import { AssetManager } from "../AssetManager";
import type { CharacterDebugView } from "../characters/Character";
import { Page } from "../Page";
import { Crowd3D } from "../characters/Crowd3D";
import { Character } from "../characters/Character";
import { appConstants } from "../../AppConstants";

export default class Path2 extends Page {
  private crowd3D?: Crowd3D;
  private characterDebugView?: CharacterDebugView;
  private readonly orbitAngularSpeed = 0.15;

  async run() {
    this.crowd3D = new Crowd3D(this.scene);
    this.crowd3D.init(10, 10, {
      count: 10,
      childRatio: 1,
    });

    // Force exactly one adult for easy visual reference.
    const characters = this.crowd3D.population.characters as Character[];
    if (characters.length > 0) {
      const worldUnitsPerMeter = 1 / appConstants.WorldUnitInMetre;
      const adult = characters[0];
      adult.scale = 1;
      adult.speed = (1.2 + Math.random() * 0.6) * worldUnitsPerMeter;
    }

    this.setupTargets();
    // setupTargets rewrites character positions after init(), so resync quadtree.
    this.crowd3D.population.setupQuadTree(this.crowd3D.population.mapWidth, this.crowd3D.population.mapHeight);

    this.camera.position.set(10, 20, -5);
    if (this.cameraControls) {
      this.cameraControls.target.set(10, 0, 15);
      this.cameraControls.update();
    }

    const assetManager = new AssetManager({ scene: this.scene } as any);
    await assetManager.init();

    this.characterDebugView = Character.createDebugView(this.scene, this.crowd3D.population.characters.length);
    Character.updateDebugView(this.characterDebugView, this.crowd3D.population.characters);

    // for (const { modelName, x, z } of BUILDINGS) {
    //   assetManager.addFastMesh(modelName, x, 0, z, 0);
    // }

  }

  private getOrbitCenter(): { x: number; z: number } {
    return {
      x: (this.crowd3D!.population.mapWidth - 1) * 0.5,
      z: (this.crowd3D!.population.mapHeight - 1) * 0.5,
    };
  }

  private getOrbitPoint(elapsed: number): { x: number; z: number } {
    if (!this.crowd3D) {
      return { x: 0, z: 0 };
    }

    const center = this.getOrbitCenter();
    const mapRadius = Math.min(center.x, center.z) - 2;



    const angle = (elapsed * this.orbitAngularSpeed) || 0;
    return {
      x: center.x + Math.sin(angle) * mapRadius,
      z: center.z + Math.cos(angle) * mapRadius,
    };
  }

  private setupTargets(): void {
    if (!this.crowd3D) {
      return;
    }

    const characters = this.crowd3D.population.characters;
    const total = characters.length;

    for (let i = 0; i < total; i++) {
      const character = characters[i];
      const target = this.getOrbitPoint(0);
      character.heading = Math.atan2(target.x, target.z);
      character.setTarget(target);
    }
  }

  private updateTargets(elapsed: number): void {
    if (!this.crowd3D) {
      return;
    }

    const characters = this.crowd3D.population.characters;
    const total = characters.length;

    for (let i = 0; i < total; i++) {
      const character = characters[i];
      character.setTarget(this.getOrbitPoint(elapsed));
    }
  }

  override loop(elapsed: number): void {
    this.updateTargets(elapsed);
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
