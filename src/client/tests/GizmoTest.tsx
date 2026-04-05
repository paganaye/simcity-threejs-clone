import * as THREE from 'three';
import { Page } from "../Page";
import { CustomGizmo } from '../editor/CustomGizmo';

const SLOPE_1_2 = Math.atan2(1, 2); // 26.565051177077986
const SLOPE_1_2_DELTA = SLOPE_1_2 - Math.PI / 8;
const GRID_SNAP = 1;
const HALF_SNAP = GRID_SNAP / 2;
const SECTOR_ANGLE = Math.PI / 8; // 16 secteurs

function Rad2Deg(rad: number): number {
  return rad * 180 / Math.PI;
}

export default class GizmoTest extends Page {
  private gizmo!: CustomGizmo;
  private proxy?: THREE.Group;
  private selectedObject?: THREE.Object3D;
  private readonly selectableObjects: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private isGizmoDragging = false;
  //private snapCallback?: (x: number, z: number, angleRadians: number) => { x: number; z: number; angle: number };
  private onPointerDown = (e: PointerEvent) => {
    if (this.gizmo?.onPointerDown(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (this.#selectAtPointer(e)) {
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

    // Create a proxy object manipulated by the gizmo.
    this.proxy = new THREE.Group();
    this.proxy.position.set(0, 0, 0);
    this.proxy.rotation.y = 0;
    this.scene.add(this.proxy);

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
        let x = position.x;
        let z = position.z;

        let sector = Math.round(rotationY / SECTOR_ANGLE);
        const type = ((sector % 4) + 4) % 4;
        let xi = Math.round(x / GRID_SNAP);
        let zi = Math.round(z / GRID_SNAP);

        let angle = sector * SECTOR_ANGLE;

        switch (type) {
          case 0: // axes
          case 2: // diagonals
            x = xi * GRID_SNAP;
            z = zi * GRID_SNAP;
            break;

          case 1: // 1:2
            angle += SLOPE_1_2_DELTA;
            x = xi * GRID_SNAP;
            if (xi & 1) z = Math.round((z - HALF_SNAP) / GRID_SNAP) * GRID_SNAP + HALF_SNAP;

            break;

          case 3: // 2:1
            angle -= SLOPE_1_2_DELTA;
            if (zi & 1)
              x = Math.round((x - HALF_SNAP) / GRID_SNAP) * GRID_SNAP + HALF_SNAP;

            z = zi * GRID_SNAP;
            break;
        }
        console.log(`type=${type} angle=${Rad2Deg(angle).toFixed(2)}° x:${x.toFixed(1)} z:${z.toFixed(1)}`);

        return { x, z, angle };
      }
    });

    this.gizmo.setVisible(false);
    this.#attachSelection(box);



    // Wire pointer events in this test page so hover/cursor feedback works.
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown, true);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove, true);
    window.addEventListener('pointerup', this.onPointerUp, true);


  }

  #pointerToNdc(event: PointerEvent): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  #selectAtPointer(event: PointerEvent): boolean {
    if (this.isGizmoDragging) {
      return false;
    }

    const mouse = this.#pointerToNdc(event);
    this.raycaster.setFromCamera(mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.selectableObjects, false);
    if (hits.length === 0) {
      return false;
    }

    this.#attachSelection(hits[0].object);
    return true;
  }

  #attachSelection(object: THREE.Object3D): void {
    if (!this.proxy) {
      return;
    }
    if (this.selectedObject === object) {
      return;
    }

    if (this.selectedObject) {
      this.scene.attach(this.selectedObject);
    }

    this.scene.updateMatrixWorld(true);

    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    this.scene.attach(object);
    object.getWorldPosition(worldPosition);
    object.getWorldQuaternion(worldQuaternion);

    const yaw = new THREE.Euler().setFromQuaternion(worldQuaternion, 'YXZ').y;
    this.proxy.position.copy(worldPosition);
    this.proxy.rotation.set(0, yaw, 0);

    this.proxy.attach(object);
    this.selectedObject = object;
    this.gizmo.setVisible(true);
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
    if (this.selectedObject) {
      this.scene.attach(this.selectedObject);
      this.selectedObject = undefined;
    }
    if (this.controls) {
      this.controls.enabled = true;
    }
  }
}
