import * as THREE from 'three';
import { Building } from '../building.js';
import { BuildingType } from '../buildingType.js';
import { assetManager } from '../../../../App.jsx';
import { City } from '../../city.jsx';

const Side = {
  Left: 'left',
  Right: 'right',
  Top: 'top',
  Bottom: 'bottom'
}

const powerLineMaterial = new THREE.LineBasicMaterial({ color: 0 });

export class PowerLine extends Building {
  type: string = "power-line";

  constructor(x: number, y: number) {
    super(x, y);
    this.type = BuildingType.powerLine;
    this.roadAccess.enabled = false;
  }

  refreshView(city: City) {
    let group = new THREE.Group();

    // Merge two powerline models, offset by 90 degrees
    let tower = assetManager.getModel(this.type, this);
    tower.rotation.y = Math.PI / 4;

    // Check which adjacent tiles are powerlines
    let top = Boolean(city.getTile(this.x, this.y - 1)?.building?.type === this.type);
    let bottom = Boolean(city.getTile(this.x, this.y + 1)?.building?.type === this.type);
    let left = Boolean(city.getTile(this.x - 1, this.y)?.building?.type === this.type);
    let right = Boolean(city.getTile(this.x + 1, this.y)?.building?.type === this.type);

    group.add(tower);

    if (top) {
      this.#addLines(group, Side.Top);
    }
    if (bottom) {
      this.#addLines(group, Side.Bottom);
    }
    if (left) {
      this.#addLines(group, Side.Left);
    }
    if (right) {
      this.#addLines(group, Side.Right);
    }

    this.setMesh(group as any);
  }

  #addLines(group: any, side: any) {
    switch (side) {
      case Side.Left:
        group.add(this.#createPowerLine(-0.09, 0.36, 0.09, -0.5, 0.36, 0.09));
        group.add(this.#createPowerLine(-0.09, 0.36, -0.09, -0.5, 0.36, -0.09));
        break;
      case Side.Right:
        group.add(this.#createPowerLine(0.09, 0.36, 0.09, 0.5, 0.36, 0.09));
        group.add(this.#createPowerLine(0.09, 0.36, -0.09, 0.5, 0.36, -0.09));
        break;
      case Side.Top:
        group.add(this.#createPowerLine(0.09, 0.36, -0.09, 0.09, 0.36, -0.5));
        group.add(this.#createPowerLine(-0.09, 0.36, -0.09, -0.09, 0.36, -0.5));
        break;
      case Side.Bottom:
        group.add(this.#createPowerLine(0.09, 0.36, 0.09, 0.09, 0.36, 0.5));
        group.add(this.#createPowerLine(-0.09, 0.36, 0.09, -0.09, 0.36, 0.5));
        break;
    }
  }

  /**
   * Creates a new power line between the start/stop points
   * @returns 
   */
  #createPowerLine(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
    const points = [
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x2, y2, z2)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const powerLine = new THREE.Line(geometry, powerLineMaterial);
    // Put in layer 1 so it doesn't interact with raycaster
    powerLine.layers.set(1);
    return powerLine;
  }


}