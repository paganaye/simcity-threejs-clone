import { BuildingType } from './buildingType.js';
import { CommercialZone } from './zones/commercial.js';
import { ResidentialZone } from './zones/residential.js';
import { IndustrialZone } from './zones/industrial.js';
import { Road } from './transportation/road.js';
import { PowerPlant } from './power/powerPlant.js';
import { PowerLine } from './power/powerLine.js';

/**
 * Creates a new building object
 * @param {number} x The x-coordinate of the building
 * @param {number} y The y-coordinate of the building
 * @param {string} type The building type
 * @returns {Building} A new building object
 */
export function createBuilding(x: number, y: number, type: string) {
  // I wonder why we have x and y as parameters here.
  x = 0;
  y = 0;
  switch (type) {
    case BuildingType.residential:
      return new ResidentialZone(x, y);
    case BuildingType.commercial:
      return new CommercialZone(x, y);
    case BuildingType.industrial:
      return new IndustrialZone(x, y);
    case BuildingType.road:
      return new Road(x, y);
    case BuildingType.powerPlant:
      return new PowerPlant(x, y);
    case BuildingType.powerLine:
      return new PowerLine(x, y);
    default:
      console.error(`${type} is not a recognized building type.`);
      return undefined;
  }
}