import * as THREE from 'three';
import { JSXElement } from 'solid-js';
import { Game3D } from './Game3D';

const SELECTED_COLOR = 0xaaaa55;
const HIGHLIGHTED_COLOR = 0x555555;

export class SimObject3D extends THREE.Object3D {
  #mesh: THREE.Mesh | null = null;
  // #worldPos = new THREE.Vector3();

  constructor(readonly scene: Game3D, public x: number = 0, public y: number = 0) {
    super();
    this.name = 'SimObject';
    this.position.set(x, 0, y)
  }

  // get x() {
  //   this.getWorldPosition(this.#worldPos);
  //   return Math.floor(this.#worldPos.x);
  // }

  // get y() {
  //   this.getWorldPosition(this.#worldPos);
  //   return Math.floor(this.#worldPos.z);
  // }

  get mesh() {
    return this.#mesh;
  }

  setMesh(value: THREE.Mesh | null) {
    // Remove resources for existing mesh
    if (this.#mesh) {
      this.dispose();
      this.remove(this.#mesh);
    }

    this.#mesh = value;

    // Add to scene graph
    if (this.#mesh) {
      this.add(this.#mesh);
    }
  }

  setSelected(value: boolean) {
    if (value) {
      this.#setMeshEmission(SELECTED_COLOR);
    } else {
      this.#setMeshEmission(0);
    }
  }

  setFocused(value: boolean) {
    if (value) {
      this.#setMeshEmission(HIGHLIGHTED_COLOR);
    } else {
      this.#setMeshEmission(0);
    }
  }

  #setMeshEmission(color: number) {
    if (!this.mesh) return;
    this.mesh.traverse((obj) => { if ('material' in obj) (obj.material as THREE.MeshLambertMaterial).emissive?.setHex(color); });
  }

  dispose() {
    this.#mesh?.traverse((obj: THREE.Object3D) => {
      if ('material' in obj) {
        (obj.material as THREE.MeshLambertMaterial).dispose();
      }
    })
  }

  toHTML(): JSXElement {
    return <p>Not implemented ${this.constructor.name}</p>;
  }
}