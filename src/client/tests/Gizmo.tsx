import * as THREE from 'three';
import { Page } from "../Page";
import { CustomGizmo } from '../editor/CustomGizmo';

export default class GizmoTest extends Page {
  private gizmo: CustomGizmo;
  private proxy?: THREE.Group;
  private raycaster = new THREE.Raycaster();

  async run() {
    console.log("a");

    //super.run();
    // Create a proxy object that will be manipulated by the gizmo
    this.proxy = new THREE.Group();
    this.proxy.position.set(0, 0, 0);
    this.proxy.rotation.y = 0;
    this.scene.add(this.proxy);

    this.proxy.position.set(1, 0, 1);

    // // Add a visual representation to the proxy
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.25;
    this.proxy.add(mesh);


    // // Create the gizmo
    this.gizmo = new CustomGizmo({
      scene: this.scene,
      camera: this.camera,
      raycaster: this.raycaster,
      domElement: this.renderer.domElement,
      proxy: this.proxy,
      onDraggingChanged: (dragging) => {
        console.log('Dragging:', dragging);
      },
    });
    this.gizmo.setVisible(true);
    this.gizmo.syncPoseFromProxy();

    // // Add ground plane for reference
    // const groundGeom = new THREE.PlaneGeometry(20, 20);
    // const groundMat = new THREE.MeshPhongMaterial({ color: 0x808080 });
    // const ground = new THREE.Mesh(groundGeom, groundMat);
    // ground.rotation.x = -Math.PI / 2;
    // this.scene.add(ground);

    // // Setup mouse event listeners
    // this.renderer.domElement.addEventListener('pointerdown', (e) => this.gizmo?.onPointerDown(e));
    // this.renderer.domElement.addEventListener('pointermove', (e) => this.gizmo?.onPointerMove(e));
    // this.renderer.domElement.addEventListener('pointerup', (e) => this.gizmo?.onPointerUp());

    // console.log('Gizmo test initialized. Drag the gizmo arrows to move/rotate the box.');
  }

  override loop(_elapsed: number): void {
    // if (this.gizmo && this.proxy) {
    //   this.gizmo.syncPoseFromProxy();
    // }
  }

  override cleanup(): void {
    // Clean up
  }
}
