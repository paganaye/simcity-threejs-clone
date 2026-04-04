import * as THREE from 'three';

type GizmoAxis = 'x' | 'z' | 'yaw';

type ICustomTransformGizmoProps = {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    raycaster: THREE.Raycaster;
    domElement: HTMLCanvasElement;
    proxy: THREE.Object3D;
    onDraggingChanged?: (dragging: boolean) => void;
};

export class CustomGizmo {
    private readonly scene: THREE.Scene;
    private readonly camera: THREE.PerspectiveCamera;
    private readonly raycaster: THREE.Raycaster;
    private readonly domElement: HTMLCanvasElement;
    private readonly proxy: THREE.Object3D;
    private readonly onDraggingChanged?: (dragging: boolean) => void;

    private readonly root = new THREE.Group();
    private activeAxis?: GizmoAxis;

    private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private readonly dragStartPoint = new THREE.Vector3();
    private readonly dragStartProxyPosition = new THREE.Vector3();
    private dragStartYaw = 0;
    private dragStartAngle = 0;
    private readonly tempRayHit = new THREE.Vector3();

    constructor(props: ICustomTransformGizmoProps) {
        this.scene = props.scene;
        this.camera = props.camera;
        this.raycaster = props.raycaster;
        this.domElement = props.domElement;
        this.proxy = props.proxy;
        this.onDraggingChanged = props.onDraggingChanged;

        this.#build();
    }

    setVisible(visible: boolean) {
        this.root.visible = visible;
        if (!visible) this.activeAxis = undefined;
    }

    syncPoseFromProxy() {
        this.root.position.set(this.proxy.position.x, 0.06, this.proxy.position.z);
        // Rotate gizmo root to match building orientation so arrows follow local axes.
        this.root.rotation.set(0, this.proxy.rotation.y, 0);

        const distance = this.camera.position.distanceTo(this.root.position);
        const s = THREE.MathUtils.clamp(distance * 0.035, 0.9, 2.5);
        this.root.scale.setScalar(s);
    }

    onPointerDown(event: PointerEvent): boolean {
        if (!this.root.visible) return false;

        const mouse = this.#pointerToNdc(event);
        if (!mouse) return false;

        this.raycaster.setFromCamera(mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.root.children, true);
        if (hits.length === 0) return false;

        let axis = hits[0].object.userData?.axis as GizmoAxis | undefined;
        if (!axis && hits[0].object.parent) {
            axis = hits[0].object.parent.userData?.axis as GizmoAxis | undefined;
        }
        if (!axis) return false;

        if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.tempRayHit)) return false;

        this.activeAxis = axis;
        this.dragStartPoint.copy(this.tempRayHit);
        this.dragStartProxyPosition.copy(this.proxy.position);
        this.dragStartYaw = this.proxy.rotation.y;

        if (axis === 'yaw') {
            this.dragStartAngle = Math.atan2(
                this.tempRayHit.z - this.dragStartProxyPosition.z,
                this.tempRayHit.x - this.dragStartProxyPosition.x
            );
        }

        this.onDraggingChanged?.(true);
        return true;
    }

    onPointerMove(event: PointerEvent): boolean {
        if (!this.activeAxis) return false;

        const mouse = this.#pointerToNdc(event);
        if (!mouse) return false;

        this.raycaster.setFromCamera(mouse, this.camera);
        if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.tempRayHit)) return false;

        const axis = this.activeAxis;
        if (axis === 'x' || axis === 'z') {
            const deltaX = this.tempRayHit.x - this.dragStartPoint.x;
            const deltaZ = this.tempRayHit.z - this.dragStartPoint.z;
            const yaw = this.dragStartYaw;
            // Project world-space delta onto the building's local axis.
            if (axis === 'x') {
                // Local X in world: (cos yaw, 0, -sin yaw)
                const lx = Math.cos(yaw), lz = -Math.sin(yaw);
                const proj = deltaX * lx + deltaZ * lz;
                this.proxy.position.x = this.dragStartProxyPosition.x + proj * lx;
                this.proxy.position.z = this.dragStartProxyPosition.z + proj * lz;
            } else {
                // Local Z in world: (sin yaw, 0, cos yaw)
                const lx = Math.sin(yaw), lz = Math.cos(yaw);
                const proj = deltaX * lx + deltaZ * lz;
                this.proxy.position.x = this.dragStartProxyPosition.x + proj * lx;
                this.proxy.position.z = this.dragStartProxyPosition.z + proj * lz;
            }
        } else {
            const currentAngle = Math.atan2(
                this.tempRayHit.z - this.dragStartProxyPosition.z,
                this.tempRayHit.x - this.dragStartProxyPosition.x
            );
            const delta = Math.atan2(
                Math.sin(currentAngle - this.dragStartAngle),
                Math.cos(currentAngle - this.dragStartAngle)
            );
            this.proxy.rotation.y = this.dragStartYaw - delta;
        }

        this.syncPoseFromProxy();
        return true;
    }

    onPointerUp() {
        if (!this.activeAxis) return;
        this.activeAxis = undefined;
        this.onDraggingChanged?.(false);
    }

    #pointerToNdc(event: PointerEvent): THREE.Vector2 | null {
        const rect = this.domElement.getBoundingClientRect();
        return new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
    }

    #build() {
        this.root.visible = false;

        const xMaterial = new THREE.MeshBasicMaterial({ color: 0xff5555, depthTest: false, transparent: true, opacity: 0.95 });
        const zMaterial = new THREE.MeshBasicMaterial({ color: 0x55a8ff, depthTest: false, transparent: true, opacity: 0.95 });
        const yMaterial = new THREE.MeshBasicMaterial({ color: 0xff9f1c, depthTest: false, transparent: true, opacity: 0.95 });

        const shaftGeom = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 12);
        const headGeom = new THREE.ConeGeometry(0.16, 0.4, 16);

        const xGroup = new THREE.Group();
        xGroup.userData.axis = 'x';
        const xShaft = new THREE.Mesh(shaftGeom, xMaterial);
        xShaft.rotation.z = -Math.PI / 2;
        xShaft.position.x = 1.05;
        xShaft.userData.axis = 'x';
        const xHead = new THREE.Mesh(headGeom, xMaterial);
        xHead.rotation.z = -Math.PI / 2;
        xHead.position.x = 2.05;
        xHead.userData.axis = 'x';
        xGroup.add(xShaft, xHead);

        const zGroup = new THREE.Group();
        zGroup.userData.axis = 'z';
        const zShaft = new THREE.Mesh(shaftGeom, zMaterial);
        zShaft.rotation.x = Math.PI / 2;
        zShaft.position.z = 1.05;
        zShaft.userData.axis = 'z';
        const zHead = new THREE.Mesh(headGeom, zMaterial);
        zHead.rotation.x = Math.PI / 2;
        zHead.position.z = 2.05;
        zHead.userData.axis = 'z';
        zGroup.add(zShaft, zHead);

        const yRing = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.11, 16, 128), yMaterial);
        yRing.rotation.x = Math.PI / 2;
        yRing.userData.axis = 'yaw';

        this.root.add(xGroup, zGroup, yRing);
        this.scene.add(this.root);
        this.domElement.style.touchAction = 'none';
    }
}
