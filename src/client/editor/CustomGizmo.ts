import * as THREE from 'three';

type GizmoAxis = 'x' | 'z' | 'xz' | 'yaw';

type ICustomTransformGizmoProps = {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    raycaster: THREE.Raycaster;
    domElement: HTMLCanvasElement;
    proxy: THREE.Object3D;
    onDraggingChanged?: (dragging: boolean) => void;
    onSnapping?: (position: THREE.Vector3, rotationY: number) => { x: number; z: number; angle: number } | undefined;
};

export class CustomGizmo {
    private readonly scene: THREE.Scene;
    private readonly camera: THREE.PerspectiveCamera;
    private readonly raycaster: THREE.Raycaster;
    private readonly domElement: HTMLCanvasElement;
    private readonly proxy: THREE.Object3D;
    private readonly onDraggingChanged?: (dragging: boolean) => void;
    private readonly onSnapping?: (position: THREE.Vector3, rotationY: number) => { x: number; z: number; angle: number } | undefined;

    private readonly root = new THREE.Group();
    private activeAxis?: GizmoAxis;
    private hoveredAxis?: GizmoAxis;

    private readonly axisBaseColors: Record<GizmoAxis, THREE.Color> = {
        x: new THREE.Color(0xff5555),
        z: new THREE.Color(0x55a8ff),
        yaw: new THREE.Color(0xff9f1c),
        xz: new THREE.Color(0xff55ff),
    };
    private readonly axisMaterials: Partial<Record<GizmoAxis, THREE.MeshBasicMaterial>> = {};

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
        this.onSnapping = props.onSnapping;

        this.#build();
    }

    #positionRoot() {
        //this.gizmo.syncPoseFromProxy(this.proxy.position, this.proxy.rotation.y);
        this.root.position.set(this.proxy.position.x, 0.06, this.proxy.position.z);
        this.root.rotation.set(0, this.proxy.rotation.y, 0);
    }

    setVisible(visible: boolean) {
        this.root.visible = visible;
        if (visible) {
            this.#positionRoot();
        } else {
            this.activeAxis = undefined;
            this.hoveredAxis = undefined;
            this.#applyAxisColors();
            this.domElement.style.cursor = '';
        }
    }

    syncPoseFromProxy(position: THREE.Vector3, rotationY: number) {
        this.root.position.set(position.x, 0.06, position.z);
        this.root.rotation.set(0, rotationY, 0);

        // Call snapping callback first
        let snapped = this.onSnapping?.(position, rotationY);

        // Apply the transform to the proxy
        if (snapped) {
            position.set(snapped.x, position.y, snapped.z);
            rotationY = snapped.angle;
        }
        this.proxy.position.copy(position);
        this.proxy.rotation.y = rotationY;
    }

    onPointerDown(event: PointerEvent): boolean {
        if (!this.root.visible) return false;

        const axis = this.#pickAxisAtPointer(event);
        if (!axis) return false;

        if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.tempRayHit)) return false;

        this.activeAxis = axis;
        this.hoveredAxis = axis;
        this.#applyAxisColors();
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
        this.domElement.style.cursor = 'grabbing';
        return true;
    }

    onPointerMove(event: PointerEvent): boolean {
        if (!this.root.visible) return false;

        if (!this.activeAxis) {
            const axis = this.#pickAxisAtPointer(event);
            if (axis !== this.hoveredAxis) {
                this.hoveredAxis = axis;
                this.#applyAxisColors();
            }
            this.domElement.style.cursor = axis ? 'pointer' : '';
            return false;
        }

        const mouse = this.#pointerToNdc(event);
        if (!mouse) return false;

        this.raycaster.setFromCamera(mouse, this.camera);
        if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.tempRayHit)) return false;

        const axis = this.activeAxis;
        const newPosition = new THREE.Vector3();
        let newRotationY = this.dragStartYaw;

        if (axis === 'x' || axis === 'z') {
            const deltaX = this.tempRayHit.x - this.dragStartPoint.x;
            const deltaZ = this.tempRayHit.z - this.dragStartPoint.z;
            const yaw = this.dragStartYaw;
            // Project world-space delta onto the building's local axis.
            if (axis === 'x') {
                // Local X in world: (cos yaw, 0, -sin yaw)
                const lx = Math.cos(yaw), lz = -Math.sin(yaw);
                const proj = deltaX * lx + deltaZ * lz;
                newPosition.x = this.dragStartProxyPosition.x + proj * lx;
                newPosition.z = this.dragStartProxyPosition.z + proj * lz;
            } else {
                // Local Z in world: (sin yaw, 0, cos yaw)
                const lx = Math.sin(yaw), lz = Math.cos(yaw);
                const proj = deltaX * lx + deltaZ * lz;
                newPosition.x = this.dragStartProxyPosition.x + proj * lx;
                newPosition.z = this.dragStartProxyPosition.z + proj * lz;
            }
            newPosition.y = this.dragStartProxyPosition.y;
        } else if (axis === 'xz') {
            const deltaX = this.tempRayHit.x - this.dragStartPoint.x;
            const deltaZ = this.tempRayHit.z - this.dragStartPoint.z;
            newPosition.x = this.dragStartProxyPosition.x + deltaX;
            newPosition.y = this.dragStartProxyPosition.y;
            newPosition.z = this.dragStartProxyPosition.z + deltaZ;
        } else {
            const currentAngle = Math.atan2(
                this.tempRayHit.z - this.dragStartProxyPosition.z,
                this.tempRayHit.x - this.dragStartProxyPosition.x
            );
            const delta = Math.atan2(
                Math.sin(currentAngle - this.dragStartAngle),
                Math.cos(currentAngle - this.dragStartAngle)
            );
            newRotationY = this.dragStartYaw - delta;
            newPosition.copy(this.dragStartProxyPosition);
        }

        this.syncPoseFromProxy(newPosition, newRotationY);
        return true;
    }

    onPointerUp() {
        if (!this.activeAxis) return;
        this.#positionRoot()
        this.activeAxis = undefined;
        this.#applyAxisColors();
        this.onDraggingChanged?.(false);
        this.domElement.style.cursor = this.hoveredAxis ? 'pointer' : '';
    }

    #pickAxisAtPointer(event: PointerEvent): GizmoAxis | undefined {
        const mouse = this.#pointerToNdc(event);
        if (!mouse) return undefined;

        this.raycaster.setFromCamera(mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.root.children, true);
        if (hits.length === 0) return undefined;

        let axis = hits[0].object.userData?.axis as GizmoAxis | undefined;
        if (!axis && hits[0].object.parent) {
            axis = hits[0].object.parent.userData?.axis as GizmoAxis | undefined;
        }
        return axis;
    }

    #applyAxisColors() {
        const dragging = !!this.activeAxis;
        (['x', 'z', 'yaw', 'xz'] as GizmoAxis[]).forEach((axis) => {
            const material = this.axisMaterials[axis];
            if (!material) return;

            const isActive = this.activeAxis === axis;
            const isHovered = this.hoveredAxis === axis;
            material.opacity = dragging ? 0.55 : 0.95;
            material.color.copy(this.axisBaseColors[axis]);
            if (isActive) {
                material.color.offsetHSL(0, 0, 0.18);
            } else if (isHovered) {
                material.color.offsetHSL(0, 0, 0.1);
            }
        });
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

        const xMaterial = new THREE.MeshBasicMaterial({ color: this.axisBaseColors.x, depthTest: false, transparent: true, opacity: 0.95 });
        const zMaterial = new THREE.MeshBasicMaterial({ color: this.axisBaseColors.z, depthTest: false, transparent: true, opacity: 0.95 });
        const yMaterial = new THREE.MeshBasicMaterial({ color: this.axisBaseColors.yaw, depthTest: false, transparent: true, opacity: 0.95 });
        const xyMaterial = new THREE.MeshBasicMaterial({ color: this.axisBaseColors.xz, depthTest: false, transparent: true, opacity: 0.95 });

        this.axisMaterials.x = xMaterial;
        this.axisMaterials.z = zMaterial;
        this.axisMaterials.yaw = yMaterial;
        this.axisMaterials.xz = xyMaterial;

        const headGeom = new THREE.ConeGeometry(0.25, 0.8, 8);

        const xGroup = new THREE.Group();
        xGroup.userData.axis = 'x';

        const centerHandle = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), xyMaterial);
        centerHandle.position.set(0, 0.05, 0);
        centerHandle.userData.axis = 'xz';

        const xHead1 = new THREE.Mesh(headGeom, xMaterial);
        xHead1.rotation.z = Math.PI / 2;
        xHead1.position.x = -2.5;
        xHead1.userData.axis = 'x';

        const xHead2 = new THREE.Mesh(headGeom, xMaterial);
        xHead2.rotation.z = -Math.PI / 2;
        xHead2.position.x = 2.5;
        xHead2.userData.axis = 'x';
        xGroup.add(xHead1, xHead2);

        const zGroup = new THREE.Group();
        zGroup.userData.axis = 'z';
        const zHead1 = new THREE.Mesh(headGeom, zMaterial);
        zHead1.rotation.x = -Math.PI / 2;
        zHead1.position.z = -2.5;
        zHead1.userData.axis = 'z';

        const zHead2 = new THREE.Mesh(headGeom, zMaterial);
        zHead2.rotation.x = Math.PI / 2;
        zHead2.position.z = 2.5;
        zHead2.userData.axis = 'z';
        zGroup.add(zHead1, zHead2);

        const yRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.2, 4, 16), yMaterial);
        yRing.rotation.x = Math.PI / 2;
        yRing.userData.axis = 'yaw';

        this.root.add(centerHandle, xGroup, zGroup, yRing);
        this.scene.add(this.root);
        this.domElement.style.touchAction = 'none';
        this.#applyAxisColors();
    }
}
