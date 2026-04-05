import * as THREE from 'three';
import { Page } from "../Page";
import { CustomGizmo } from '../editor/CustomGizmo';


export default class GizmoTest extends Page {
  private gizmo!: CustomGizmo;
  private readonly selectableObjects: THREE.Object3D[] = [];
  //private snapCallback?: (x: number, z: number, angleRadians: number) => { x: number; z: number; angle: number };
  private onPointerDown = (e: PointerEvent) => {
    this.gizmo?.onPointerDown(e);
  };
  private onPointerMove = (e: PointerEvent) => {
    this.gizmo?.onPointerMove(e);
  };
  private onPointerUp = (e: PointerEvent) => {
    this.gizmo?.onPointerUp(e);
  };

  async run() {
    this.camera.position.set(8, 8, 8);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x666666, 1.1);
    this.scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(6, 10, 4);
    this.scene.add(dirLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshPhongMaterial({ color: 0x444444, depthWrite: false })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // Add a few selectable primitives in the scene.
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 2),
      new THREE.MeshPhongMaterial({ color: 0x23a455 })
    );
    box.position.set(0, 0.5, 0);
    this.scene.add(box);
    this.selectableObjects.push(box);

    const box2 = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 2),
      new THREE.MeshPhongMaterial({ color: 0x2b6de0 })
    );
    box2.position.set(2, 0.5, 0);
    this.scene.add(box2);
    this.selectableObjects.push(box2);

    const box3 = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 2),
      new THREE.MeshPhongMaterial({ color: 0xe0a32b })
    );
    box3.position.set(0, 0.5, 2);
    this.scene.add(box3);
    this.selectableObjects.push(box3);

    const box4 = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 2),
      new THREE.MeshPhongMaterial({ color: 0xa3e02b })
    );
    box4.position.set(2, 0.5, 2);
    this.scene.add(box4);
    this.selectableObjects.push(box4);


    // // Create the gizmo
    this.gizmo = new CustomGizmo({
      scene: this.scene,
      camera: this.camera,
      domElement: this.renderer.domElement,
      selectableObjects: this.selectableObjects,
      onDraggingChanged: (dragging) => {
        if (this.controls) {
          this.controls.enabled = !dragging;
        }
      }
    });

    this.gizmo.setVisible(false);
    this.gizmo.setSelection(box);



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
    this.gizmo?.clearSelection();
    if (this.controls) {
      this.controls.enabled = true;
    }
  }
}
