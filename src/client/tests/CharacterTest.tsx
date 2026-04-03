import { Page } from "../Page";
import { Population } from "../Population";

export default class CharacterTest extends Page {
  private population?: Population;

  run(): Promise<void> | void {
    this.population = new Population(this.scene);
    this.population.init(8, 8, {
      density: 0.08,
      minCount: 120,
      maxCount: 300,
      childRatio: 0.18,
      walkingRatio: 0.7,
    });
  }

  override loop(elapsed: number): void {
    this.population?.update(elapsed, 64, 64);
  }

  override cleanup(): void {
    this.population?.dispose();
    this.population = undefined;
  }
}
