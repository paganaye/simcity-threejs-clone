import * as THREE from 'three';
import { Page } from "../Page";
import { CustomGizmo } from '../editor/CustomGizmo';

export default class GizmoTest extends Page {
  private gizmo!: CustomGizmo;
  private proxy?: THREE.Group;
  private raycaster = new THREE.Raycaster();
  private isGizmoDragging = false;
  //private snapCallback?: (x: number, z: number, angleRadians: number) => { x: number; z: number; angle: number };
  private onPointerDown = (e: PointerEvent) => {
    if (this.gizmo?.onPointerDown(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  private onPointerMove = (e: PointerEvent) => {
    if (this.gizmo?.onPointerMove(e)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  private onPointerUp = (e: PointerEvent) => {
    if (this.isGizmoDragging) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.gizmo?.onPointerUp();
  };

  async run() {
    this.camera.position.set(8, 8, 8);

    // Create a proxy object that will be manipulated by the gizmo
    this.proxy = new THREE.Group();
    this.proxy.position.set(0, 0, 0);
    this.proxy.rotation.y = 0;
    this.scene.add(this.proxy);

    this.proxy.position.set(5, 0, 1);

    // // Add a visual representation to the proxy
    const geometry = new THREE.BoxGeometry(4, 1, 4);
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(geometry, material);
    this.proxy.add(mesh);


    // // Create the gizmo
    this.gizmo = new CustomGizmo({
      scene: this.scene,
      camera: this.camera,
      raycaster: this.raycaster,
      domElement: this.renderer.domElement,
      proxy: this.proxy,
      onDraggingChanged: (dragging) => {
        this.isGizmoDragging = dragging;
        if (this.controls) {
          this.controls.enabled = !dragging;
        }
      },
      onSnapping: (position, rotationY) => {
        let x = Math.round(position.x / 2) * 2;
        let z = Math.round(position.z / 2) * 2;
        let angle = Math.round(rotationY / (Math.PI / 8)) * (Math.PI / 8);
        return { x, z, angle };
      }
    });
    this.gizmo.setVisible(true);
    //this.gizmo.syncPoseFromProxy();



    // Wire pointer events in this test page so hover/cursor feedback works.
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown, true);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove, true);
    window.addEventListener('pointerup', this.onPointerUp, true);


  }

  override loop(_elapsed: number): void {
    //if (this.gizmo && this.proxy && this.snapCallback) {
    // this.gizmo.syncPoseFromProxy();

    // // Apply snapping to proxy position and rotation
    // const snapped = this.snapCallback(
    //   this.proxy.position.x,
    //   this.proxy.position.z,
    //   this.proxy.rotation.y
    // );
    // this.proxy.position.x = snapped.x;
    // this.proxy.position.z = snapped.z;
    // this.proxy.rotation.y = snapped.angle;
    //}
  }

  override cleanup(): void {
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown, true);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove, true);
    window.removeEventListener('pointerup', this.onPointerUp, true);
    if (this.controls) {
      this.controls.enabled = true;
    }
  }
}
