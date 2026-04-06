import { describe, expect, it, beforeEach } from 'vitest';

import { appConstants } from '../AppConstants';
import { CAR_MODEL_IDS } from '../common/ModelIds';
import { randomize } from './Rng';
import { Sim } from './Sim';

describe('SimCars', () => {
  beforeEach(() => {
    randomize(42);
  });

  it('creates the expected amount of cars and emits changes', () => {
    const sim = new Sim();
    sim.simCars.feedRandom(6);

    expect(sim.simCars.cars).toHaveLength(6);

    const changes = sim.simCars.getCarChanged();
    expect(changes).toHaveLength(6);

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      expect(change.id).toBe(i);
      expect(change.path).toBeDefined();
      expect(change.path!.length).toBeGreaterThan(1);
    }
  });

  it('keeps generated path points in city bounds and with valid model ids', () => {
    const sim = new Sim();
    sim.simCars.feedRandom(8);

    for (const car of sim.simCars.cars) {
      expect(CAR_MODEL_IDS.includes(car.model)).toBe(true);

      const change = car.getCarChange();
      expect(change?.path).toBeDefined();

      for (const point of change!.path!) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThan(appConstants.defaultCitySize);
        expect(point.z).toBeGreaterThanOrEqual(0);
        expect(point.z).toBeLessThan(appConstants.defaultCitySize);
      }
    }
  });
});
