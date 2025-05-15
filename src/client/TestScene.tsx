import * as THREE from "three";
import { DEG2RAD } from "three/src/math/MathUtils";
import { RoadBuilder } from "./RoadBuilder";
import { instancedMeshes } from "./instancedMeshes";


export function testScene(scene: THREE.Scene): ((ellapse: number) => void) | void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);


    // stencilBuffer(scene)
    return instancedMeshes(scene);
    //roads(scene);
}

export function stencilBuffer(scene: THREE.Scene) {

    const ambientLight = new THREE.AmbientLight(0x404040); // Soft ambient light
    scene.add(ambientLight);

    // Optional: a directional light for better surface rendering
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Material for the "hole" (stencil mask)
    // This material makes the hole geometry invisible but writes to the stencil buffer.
    const holeMaterial = new THREE.MeshBasicMaterial({
        colorWrite: false,    // Don't write to the color buffer (makes it invisible).
        depthWrite: false,    // Don't write to the depth buffer for stencil-only objects
        // if depth is primarily handled by the visible objects.
        depthTest: true,      // CRITICAL FIX: Stencil writing should respect depth.
        // This ensures the hole doesn't cut parts of the cube
        // that are in front of the cylinder.
        stencilWrite: true,   // Enable writing to the stencil buffer.
        stencilFunc: THREE.AlwaysStencilFunc, // Stencil test always passes for this material's pixels.
        stencilRef: 1,        // The reference value to write to the stencil buffer.
        stencilZPass: THREE.ReplaceStencilOp, // Replace stencil buffer value with stencilRef if stencil and depth tests pass.
        side: THREE.FrontSide // Defines which side of the hole geometry faces are considered for stencil writing. FrontSide is usually fine.
    });

    // Geometry for the hole (a cylinder)
    const holeGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.5, 32); // Radius, Height, Segments
    const hole = new THREE.Mesh(holeGeometry, holeMaterial);
    hole.position.set(0, 0, 0); // Positioned at the center of its parent (the cube)
    hole.renderOrder = 0;       // Render the hole (stencil mask) first.

    // Material for the cube, which will be "cut" by the stencil
    const cubeStencilMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff00,      // Green color for the cube
        metalness: 0.1,
        roughness: 0.5,
        stencilWrite: true,   // The cube material interacts with the stencil buffer (it reads from it).
        // Can be set to false if only reading and not modifying stencil further.
        stencilRef: 1,        // The reference value to test against.
        stencilFunc: THREE.NotEqualStencilFunc, // Draw pixels only where stencil buffer value is NOT equal to stencilRef (1).
        // This means where the hole *didn't* write, or where it wrote a different value.
        stencilZPass: THREE.KeepStencilOp, // If stencil test passes and depth test passes, keep the existing stencil value.
        // This prevents the cube from altering the stencil mask values written by the hole.
        depthWrite: true,     // Standard for opaque objects to write to depth buffer.
        side: THREE.DoubleSide // VISUAL IMPROVEMENT: Render both front and back faces of the cube.
        // This makes the inside of the cut visible.
    });

    // Geometry for the cube
    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1); // Width, Height, Depth
    const cube = new THREE.Mesh(cubeGeometry, cubeStencilMaterial);
    cube.renderOrder = 1;     // Render the cube after the hole (stencil mask) has been processed.

    // Add the hole as a child of the cube.
    // Its transformations will be relative to the cube.
    cube.add(hole);
    scene.add(cube);
}

export function roadsScene(scene: THREE.Scene) {
    function angle(angleInDegree: number) {
        return DEG2RAD * angleInDegree;
    }

    let radius = 1;

    const builder = new RoadBuilder({ x: -1, y: 0.015, z: 4, angle: 0 }, scene);
    builder.addStraightRoad(1, 'none', 'l1');
    builder.addTurningRoad(angle(30), radius, 'none', 'l1');
    builder.addStraightRoad(2, 'none', 'l2');
    builder.addTurningRoad(angle(-30), radius, 'none', 'l2');
    builder.addStraightRoad(1, 'none', 'l3');
    builder.addTurningRoad(angle(90), radius, 'none', 'l3');
    builder.addStraightRoad(4.2, 'l3', 'l3');
    builder.addTurningRoad(angle(90), radius, 'l4');
    builder.addStraightRoad(4.2, 'l5');
    builder.addTurningRoad(angle(90), radius, 'l5');
    builder.addStraightRoad(3.6, 'l6');
    builder.addTurningRoad(angle(-30), radius, 'l6');
    builder.addStraightRoad(1, 'l1', 'l1');
    builder.addTurningRoad(angle(120), radius, 'l1', 'l1');
    builder.addStraightRoad(0.25, 'none', 'l1');




}


