import { Page } from "../Page";
import { Crowd3D } from "../characters/Crowd3D";

export default class CharacterTest extends Page {
  private crowd3D?: Crowd3D;

  run(): Promise<void> | void {
    this.crowd3D = new Crowd3D(this.scene);
    this.crowd3D.init(8, 8, {
      count: 120,
      childRatio: 0.18
    });
    this.camera.position.set(8, 8, 8);
  }

  override loop(elapsed: number): void {
    this.crowd3D?.tick(elapsed);
  }

  override cleanup(): void {
    this.crowd3D?.dispose();
    this.crowd3D = undefined;
  }
}
