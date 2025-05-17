import * as THREE from "three";
import { SceneContext,  SceneInitResult } from "../..";


export default function roadSceneTest(scene: SceneContext): SceneInitResult {
    const numInstances = 100;
    const planeSize = 2;

    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize, 1, 1);

    const instancePositions = new Float32Array(numInstances * 3);
    const instanceColors = new Float32Array(numInstances * 3);

    for (let i = 0; i < numInstances; i++) {
        instancePositions[i * 3 + 0] = (Math.random() - 0.5) * 20;
        instancePositions[i * 3 + 2] = (Math.random() - 0.5) * 20;

    }

    planeGeometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
    planeGeometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(instanceColors, 3));

    const material = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        transparent: true
    });

    const instancedMesh = new THREE.InstancedMesh(planeGeometry, material, numInstances);
    scene.add(instancedMesh);

    function animate(_ellapsed?: number) {
    }
    return { animate };
}


