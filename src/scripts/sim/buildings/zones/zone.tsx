import * as THREE from 'three';
import { DEG2RAD } from 'three/src/math/MathUtils.js';
import { DevelopmentModule, DevelopmentState } from '../modules/development.js';
import { Building } from '../building.js';
import { assetManager } from '../../../../App.jsx';
import { City } from '../../city.jsx';
import { JSXElement } from 'solid-js';

/**
 * Represents a zoned building such as residential, commercial or industrial
 */
export abstract class Zone extends Building {
  /**
   * The mesh style to use when rendering
   */
  style = ['A', 'B', 'C'][Math.floor(3 * Math.random())];

  /**
   * @type {DevelopmentModule}
   */
  development = new DevelopmentModule(this);

  constructor(x = 0, y = 0) {
    super(x, y);

    this.name = 'Zone';
    this.power.required = 10;

    // Randomize the building rotation
    this.rotation.y = 90 * Math.floor(4 * Math.random()) * DEG2RAD;
  }

  refreshView() {
    let modelName;
    switch (this.development.state) {
      case DevelopmentState.underConstruction:
      case DevelopmentState.undeveloped:
        modelName = 'under-construction';
        break;
      default:
        modelName = `${this.type}-${this.style}${this.development.level}`;
        break;
    }

    let mesh = assetManager.getModel(modelName, this);

    // Tint building a dark color if it is abandoned
    if (this.development.state === DevelopmentState.abandoned) {
      mesh.traverse((obj) => {
        if ('material' in obj && obj.material) {
          (obj.material as THREE.MeshStandardMaterial).color = new THREE.Color(0x707070);
        }
      });
    }

    this.setMesh(mesh);
  }

  simulate(city: City) {
    super.simulate(city);
    this.development.simulate(city);
  }

  /**
   * Returns an HTML representation of this object
   * @returns {string}
   */
  toHTML(): JSXElement {
    return <>
      {super.toHTML()}
      {this.development.toHTML()}
    </>
  }
}