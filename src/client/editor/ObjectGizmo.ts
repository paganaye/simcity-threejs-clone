import * as THREE from 'three';
import { CustomGizmo, type ICustomGizmoProps } from './CustomGizmo';

type GizmoAxis = 'x' | 'z' | 'xz' | 'yaw';

export type GizmoSelectableType = 'building' | 'character' | 'road';

export type ISelectedInstance = {
    mesh: THREE.InstancedMesh;
    instanceId: number;
    selectableType: GizmoSelectableType;
};

type IObjectGizmoProps = ICustomGizmoProps & {
    isSelectable: (object: THREE.Object3D) => boolean;
    getSelectedInstance?: () => ISelectedInstance | undefined;
    getInstanceYaw?: (mesh: THREE.InstancedMesh, instanceId: number) => number;
    onTryUpdateSelectedInstanceTransform?: (mesh: THREE.InstancedMesh, instanceId: number, x: number, z: number, yaw: number) => boolean;
    onTransformValidityChanged?: (valid: boolean) => void;
    onSelectObject?: (object: THREE.Object3D) => void;
    onSnapping?: (position: THREE.Vector3, rotationY: number) => { x: number; z: number; angle: number } | undefined;
};

const GIZMO_MIN_SCALE = 0.5;
const GIZMO_SCALE_DISTANCE_FACTOR = 0.04;

export class ObjectGizmo extends CustomGizmo {
    private readonly proxy = new THREE.Group();
    private selectedObject?: THREE.Object3D;
    private readonly isSelectable: (object: THREE.Object3D) => boolean;
    private readonly getSelectedInstance?: () => ISelectedInstance | undefined;
    private readonly getInstanceYaw?: (mesh: THREE.InstancedMesh, instanceId: number) => number;
    private readonly onTryUpdateSelectedInstanceTransform?: (mesh: THREE.InstancedMesh, instanceId: number, x: number, z: number, yaw: number) => boolean;
    private readonly onTransformValidityChanged?: (valid: boolean) => void;
    private readonly onSelectObject?: (object: THREE.Object3D) => void;
    private readonly onSnapping?: (position: THREE.Vector3, rotationY: number) => { x: number; z: number; angle: number } | undefined;

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
    private readonly tempMatrix = new THREE.Matrix4();
    private readonly tempPosition = new THREE.Vector3();
    private readonly tempQuaternion = new THREE.Quaternion();
    private readonly tempScale = new THREE.Vector3();
    private readonly tempEuler = new THREE.Euler();
    private readonly cameraToGizmo = new THREE.Vector3();

    constructor(props: IObjectGizmoProps) {
        super(props);
        this.isSelectable = props.isSelectable;
        this.getSelectedInstance = props.getSelectedInstance;
        this.getInstanceYaw = props.getInstanceYaw;
        this.onTryUpdateSelectedInstanceTransform = props.onTryUpdateSelectedInstanceTransform;
        this.onTransformValidityChanged = props.onTransformValidityChanged;
        this.onSelectObject = props.onSelectObject;
        this.onSnapping = props.onSnapping;

        this.proxy.visible = false;
        this.scene.add(this.proxy);

        this.#build();
    }

    setSelection(object: THREE.Object3D): void {
        if (object === this.proxy) {
            this.selectedObject = undefined;
            this.proxy.visible = true;
            this.setVisible(true);
            return;
        }

        if (this.selectedObject === object) {
            this.setVisible(true);
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
        this.proxy.visible = true;
        this.setVisible(true);
    }

    clearSelection(): void {
        if (this.selectedObject) {
            this.scene.attach(this.selectedObject);
            this.selectedObject = undefined;
        }
        this.proxy.visible = false;
        this.setVisible(false);
    }

    syncSelectionFromSelectedInstance(): void {
        const selected = this.getSelectedInstance?.();
        if (!selected || selected.selectableType !== 'building') {
            this.proxy.visible = false;
            this.clearSelection();
            return;
        }

        const { mesh, instanceId } = selected;
        mesh.getMatrixAt(instanceId, this.tempMatrix);
        this.tempMatrix.decompose(this.tempPosition, this.tempQuaternion, this.tempScale);
        const yaw = this.getInstanceYaw
            ? this.getInstanceYaw(mesh, instanceId)
            : this.tempEuler.setFromQuaternion(this.tempQuaternion, 'YXZ').y;

        this.clearSelection();
        this.proxy.position.copy(this.tempPosition);
        this.proxy.position.y = 0;
        this.proxy.rotation.set(0, yaw, 0);
        this.proxy.visible = true;
        this.setVisible(true);
    }

    #positionRoot() {
        this.root.position.set(this.proxy.position.x, 0.06, this.proxy.position.z);
        this.root.rotation.set(0, this.proxy.rotation.y, 0);
        this.#updateScale();
    }

    #updateScale() {
        if (!this.root.visible) return;

        this.cameraToGizmo.subVectors(this.camera.position, this.root.position);
        const distance = this.cameraToGizmo.length();
        const scale = Math.max(GIZMO_MIN_SCALE, distance * GIZMO_SCALE_DISTANCE_FACTOR);
        this.root.scale.setScalar(scale);
    }

    override update() {
        this.#updateScale();
    }

    override setVisible(visible: boolean) {
        super.setVisible(visible);
        if (visible) {
            this.#positionRoot();
            return;
        }

        this.activeAxis = undefined;
        this.hoveredAxis = undefined;
        this.#applyAxisColors();
    }

    #syncPoseFromProxy(position: THREE.Vector3, rotationY: number) {
        this.root.position.set(position.x, 0.06, position.z);
        this.root.rotation.set(0, rotationY, 0);

        const controlsSelectedInstance = !this.selectedObject;

        let snapped = controlsSelectedInstance ? (this.onSnapping ?? this.defaultSnapping)(position, rotationY) : undefined;

        if (snapped) {
            position.set(snapped.x, position.y, snapped.z);
            rotationY = snapped.angle;
        }

        const selected = this.getSelectedInstance?.();
        if (controlsSelectedInstance && selected && selected.selectableType === 'building' && this.onTryUpdateSelectedInstanceTransform) {
            const ok = this.onTryUpdateSelectedInstanceTransform(
                selected.mesh,
                selected.instanceId,
                position.x,
                position.z,
                rotationY,
            );
            this.onTransformValidityChanged?.(ok);

            if (!ok) {
                selected.mesh.getMatrixAt(selected.instanceId, this.tempMatrix);
                this.tempMatrix.decompose(this.tempPosition, this.tempQuaternion, this.tempScale);
                const yaw = this.getInstanceYaw
                    ? this.getInstanceYaw(selected.mesh, selected.instanceId)
                    : this.tempEuler.setFromQuaternion(this.tempQuaternion, 'YXZ').y;
                this.proxy.position.copy(this.tempPosition);
                this.proxy.position.y = 0;
                this.proxy.rotation.set(0, yaw, 0);
                return;
            }
        }

        this.proxy.position.copy(position);
        this.proxy.rotation.y = rotationY;
    }

    onPointerDown(event: PointerEvent): boolean {
        const axis = this.root.visible ? this.#pickAxisAtPointer(event) : undefined;
        if (!axis) {
            const selectable = this.#pickSelectableAtPointer(event);
            if (selectable) {
                event.preventDefault();
                event.stopPropagation();
                if (selectable.userData?.selectableType !== 'road') {
                    this.setSelection(selectable);
                }
                this.onSelectObject?.(selectable);
                return true;
            }
            return false;
        }

        this.raycaster.setFromCamera(this.pointerToNdc(event), this.camera);
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

        event.preventDefault();
        event.stopPropagation();
        this.onDraggingChanged?.(true);
        this.domElement.style.cursor = 'grabbing';
        return true;
    }

    #pickSelectableAtPointer(event: PointerEvent): THREE.Object3D | undefined {
        const mouse = this.pointerToNdc(event);

        this.raycaster.setFromCamera(mouse, this.camera);

        const selectableObjects: THREE.Object3D[] = [];
        this.scene.traverse((obj) => {
            if (this.isSelectable?.(obj)) {
                selectableObjects.push(obj);
            }
        });

        if (selectableObjects.length === 0) {
            return undefined;
        }

        const hits = this.raycaster.intersectObjects(selectableObjects, false);
        const hitObject = hits[0]?.object;
        if (!hitObject) return undefined;
        return this.#resolveSelectableTarget(hitObject);
    }

    #resolveSelectableTarget(object: THREE.Object3D): THREE.Object3D {
        let target = object;
        let parent = target.parent;

        while (parent && this.isSelectable(parent)) {
            target = parent;
            parent = target.parent;
        }

        return target;
    }

    onPointerMove(event: PointerEvent): boolean {
        if (!this.root.visible) return false;

        if (!this.activeAxis) {
            const axis = this.#pickAxisAtPointer(event);
            if (axis !== this.hoveredAxis) {
                this.hoveredAxis = axis;
                this.#applyAxisColors();
            }
            this.domElement.style.cursor = axis ? 'pointer' : this.resolveDefaultCursor();
            return false;
        }

        this.raycaster.setFromCamera(this.pointerToNdc(event), this.camera);
        if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.tempRayHit)) return false;

        const axis = this.activeAxis;
        const newPosition = new THREE.Vector3();
        let newRotationY = this.dragStartYaw;

        if (axis === 'x' || axis === 'z') {
            const deltaX = this.tempRayHit.x - this.dragStartPoint.x;
            const deltaZ = this.tempRayHit.z - this.dragStartPoint.z;
            const yaw = this.dragStartYaw;
            if (axis === 'x') {
                const lx = Math.cos(yaw), lz = -Math.sin(yaw);
                const proj = deltaX * lx + deltaZ * lz;
                newPosition.x = this.dragStartProxyPosition.x + proj * lx;
                newPosition.z = this.dragStartProxyPosition.z + proj * lz;
            } else {
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

        event.preventDefault();
        event.stopPropagation();
        this.#syncPoseFromProxy(newPosition, newRotationY);
        return true;
    }

    onPointerUp(event?: PointerEvent) {
        if (!this.activeAxis) return;
        event?.preventDefault();
        event?.stopPropagation();
        this.#positionRoot();
        this.activeAxis = undefined;
        this.#applyAxisColors();
        this.onDraggingChanged?.(false);
        this.domElement.style.cursor = this.hoveredAxis ? 'pointer' : this.resolveDefaultCursor();
    }

    #pickAxisAtPointer(event: PointerEvent): GizmoAxis | undefined {
        this.raycaster.setFromCamera(this.pointerToNdc(event), this.camera);
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
        this.#applyAxisColors();
    }
}
