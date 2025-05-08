import { city } from '../../../../App.jsx';
import config from '../../../config.js';
import { Building } from '../building.jsx';
import { SimModule } from './simModule.js';

/**
 * Logic for determining whether or not a tile has road access
 */
export class RoadAccessModule extends SimModule {
  /**
   * @type {Building}
   */
  building;
  /**
   * @type {boolean}
   */
  enabled = true;
  /**
   * Whether or not the tile has access to a road
   * @type {boolean}
   */
  value: any;

  /**
   * @param {Building} building 
   */
  constructor(building: Building) {
    super();
    this.building = building;
  }

  /**
   * Updates the state of this attribute
   * @param {City} city 
   */
  simulate() {
    if (!this.enabled) {
      this.value = true;
    } else {
      const road = city.findTile(
        this.building,
        (tile) => tile.building?.type === 'road',
        config.modules.roadAccess.searchDistance);

      this.value = (road !== null);
    }
  }
}