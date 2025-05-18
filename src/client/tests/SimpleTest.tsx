import * as THREE from "three";
import { Page } from "../Page";

export default class SimpleTest extends Page {
    async run() {
        const cubeGeometry = new THREE.BoxGeometry();
        const material = new THREE.MeshStandardMaterial();
        const cube = new THREE.Mesh(cubeGeometry, material);
        this.scene.add(cube);

    }

}
