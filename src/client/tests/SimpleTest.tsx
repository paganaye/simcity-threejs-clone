import * as THREE from "three";
import { SceneContext, SceneInitResult } from "../..";

export default function simpleTest({ scene }: SceneContext): SceneInitResult | void {
    const cubeGeometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    const cube = new THREE.Mesh(cubeGeometry, material);
    scene.add(cube);

    // return {
    //     animate: (elapsedTime: number) => {
    //     }
    // };
}
