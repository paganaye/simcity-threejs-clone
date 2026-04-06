import { beforeEach, describe, expect, it } from 'vitest';

import { randomize } from './Rng';
import { Sim } from './Sim';

describe('SimCharacter / SimCharacters', () => {
  beforeEach(() => {
    randomize(7);
  });

  it('creates coherent family households', () => {
    const sim = new Sim();
    sim.simCharacters.feedRandom(3);

    expect(sim.simCharacters.households.length).toBe(3);
    expect(sim.simCharacters.characters.length).toBeGreaterThanOrEqual(6);

    for (const household of sim.simCharacters.households) {
      expect(household.memberIds.length).toBeGreaterThanOrEqual(2);
      expect([1, 2].includes(household.carCount)).toBe(true);
    }
  });

  it('updates needs within bounds and records changes', () => {
    const sim = new Sim();
    const character = sim.simCharacters.createCharacter('male');

    character.activity = 'sleeping';
    character.needs = {
      hunger: 99,
      energy: 99,
      fun: 1,
      social: 1,
    };

    character.tick(1, 23);

    expect(character.needs.hunger).toBeLessThanOrEqual(100);
    expect(character.needs.energy).toBeLessThanOrEqual(100);
    expect(character.needs.fun).toBeGreaterThanOrEqual(0);
    expect(character.needs.social).toBeGreaterThanOrEqual(0);

    const changed = sim.simCharacters.getCharacterChanged();
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.some(c => c.id === character.id)).toBe(true);
  });

  it('follows expected worker day schedule transitions', () => {
    const sim = new Sim();
    const character = sim.simCharacters.createCharacter('female');

    character.job = {
      type: 'worker',
      income: 1500,
      startHour: 7,
      endHour: 16,
      workplaceTile: null,
    };
    character.activity = 'home';

    character.tick(0.01, 23);
    expect(character.activity).toBe('sleeping');

    character.tick(0.01, 6);
    expect(character.activity).toBe('commuting_to_work');

    character.tick(0.01, 8);
    expect(character.activity).toBe('working');

    character.tick(0.01, 16);
    expect(character.activity).toBe('commuting_home');

    character.tick(0.01, 18);
    expect(character.activity).toBe('home');
  });
});
