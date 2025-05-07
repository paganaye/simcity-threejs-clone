import { Building } from '../building.js';
import { City } from '../../city.js';
import { DEG2RAD } from 'three/src/math/MathUtils.js';
import { assetManager } from '../../../../App.jsx';
import { JSXElement } from 'solid-js';

export class Road extends Building {
  type: string = "road";

  style: string;
  constructor(x: number, y: number) {
    super(x, y);
    this.type = 'road';
    this.name = 'Road';
    this.style = 'straight';
    this.hideTerrain = true;
    this.roadAccess.enabled = false;
  }

  /**
   * Updates the road mesh based on which adjacent tiles are roads as well
   * @param {City} city 
   */
  refreshView(city: City) {
    // Check which adjacent tiles are roads
    let top = Boolean(city.getTile(this.x, this.y - 1)?.building?.type === this.type);
    let bottom = Boolean(city.getTile(this.x, this.y + 1)?.building?.type === this.type);
    let left = Boolean(city.getTile(this.x - 1, this.y)?.building?.type === this.type);
    let right = Boolean(city.getTile(this.x + 1, this.y)?.building?.type === this.type);

    // Check all combinations
    // Four-way intersection
    if (top && bottom && left && right) {
      this.style = 'four-way';
      this.rotation.y = 0;
      // T intersection
    } else if (!top && bottom && left && right) { // bottom-left-right
      this.style = 'three-way';
      this.rotation.y = 0;
    } else if (top && !bottom && left && right) { // top-left-right
      this.style = 'three-way';
      this.rotation.y = 180 * DEG2RAD;
    } else if (top && bottom && !left && right) { // top-bottom-right
      this.style = 'three-way';
      this.rotation.y = 90 * DEG2RAD;
    } else if (top && bottom && left && !right) { // top-bottom-left
      this.style = 'three-way';
      this.rotation.y = 270 * DEG2RAD;
      // Corner
    } else if (top && !bottom && left && !right) { // top-left
      this.style = 'corner';
      this.rotation.y = 180 * DEG2RAD;
    } else if (top && !bottom && !left && right) { // top-right
      this.style = 'corner';
      this.rotation.y = 90 * DEG2RAD;
    } else if (!top && bottom && left && !right) { // bottom-left
      this.style = 'corner';
      this.rotation.y = 270 * DEG2RAD;
    } else if (!top && bottom && !left && right) { // bottom-right
      this.style = 'corner';
      this.rotation.y = 0;
      // Straight
    } else if (top && bottom && !left && !right) { // top-bottom
      this.style = 'straight';
      this.rotation.y = 0;
    } else if (!top && !bottom && left && right) { // left-right
      this.style = 'straight';
      this.rotation.y = 90 * DEG2RAD;
      // Dead end
    } else if (top && !bottom && !left && !right) { // top
      this.style = 'end';
      this.rotation.y = 180 * DEG2RAD;
    } else if (!top && bottom && !left && !right) { // bottom
      this.style = 'end';
      this.rotation.y = 0;
    } else if (!top && !bottom && left && !right) { // left
      this.style = 'end';
      this.rotation.y = 270 * DEG2RAD;
    } else if (!top && !bottom && !left && right) { // right
      this.style = 'end';
      this.rotation.y = 90 * DEG2RAD;
    }

    const mesh = assetManager.getModel(`road-${this.style}`, this);
    this.setMesh(mesh);
    city.vehicleGraph?.updateTile(this.x, this.y, this);
  }

  /**
   * Returns an HTML representation of this object
   * @returns {string}
   */
  toHTML(): JSXElement {
    return (<>
      {super.toHTML()}
      <span class="info-label">Style </span>
      <span class="info-value">{this.style}</span>
      <br />
    </>);
  }
}