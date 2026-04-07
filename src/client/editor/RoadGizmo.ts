import * as THREE from 'three';
import { CustomGizmo, type ICustomGizmoProps, type IRoadHandle } from './CustomGizmo';

type RoadHandleAxis = 'start' | 'end';

export type IRoadGizmoProps = ICustomGizmoProps;

const MIN_ROAD_LENGTH = 0.5;
const HANDLE_Y = 0.12;

export class RoadGizmo extends CustomGizmo {
    getSelectedRoadHandle?: () => IRoadHandle | undefined;
    onRoadMoved?: (x: number, z: number, angle: number) => void;
    onRoadResized?: (newLength: number) => void;
    onDeselect?: () => void;

    private readonly axisMaterials: Record<RoadHandleAxis, THREE.MeshBasicMaterial>;
    private readonly axisBaseColors: Record<RoadHandleAxis, THREE.Color> = {
        start: new THREE.Color(0x55a8ff),
        end: new THREE.Color(0x44ff44),
    };
    private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private readonly tempRayHit = new THREE.Vector3();
    private readonly dragFixedPoint = new THREE.Vector3();
    private activeAxis?: RoadHandleAxis;
    private hoveredAxis?: RoadHandleAxis;
    private selected = false;

    constructor(props: IRoadGizmoProps) {
        super(props);

        this.axisMaterials = {
            start: new THREE.MeshBasicMaterial({ color: this.axisBaseColors.start, depthTest: false, transparent: true, opacity: 0.95 }),
            end: new THREE.MeshBasicMaterial({ color: this.axisBaseColors.end, depthTest: false, transparent: true, opacity: 0.95 }),
        };

        this.#build();
    }

    setRoadSelection(_handle: IRoadHandle): void {
        this.selected = true;
        this.setVisible(true);
        this.#positionHandlesFromRoad();
    }

    clearSelection(): void {
        this.selected = false;
        this.activeAxis = undefined;
        this.hoveredAxis = undefined;
        this.setVisible(false);
        this.#applyAxisColors();
        this.onDeselect?.();
    }

    override update() {
        if (!this.root.visible) return;
        this.#positionHandlesFromRoad();
    }

    override setVisible(visible: boolean) {
        super.setVisible(visible);
        if (!visible) {
            this.activeAxis = undefined;
            this.hoveredAxis = undefined;
            this.#applyAxisColors();
        }
    }

    onPointerDown(event: PointerEvent): boolean {
        if (!this.root.visible) return false;

        const axis = this.#pickAxisAtPointer(event);
        if (!axis) return false;

        const road = this.getSelectedRoadHandle?.();
        if (!road) return false;

        this.raycaster.setFromCamera(this.pointerToNdc(event), this.camera);
        if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.tempRayHit)) return false;

        this.activeAxis = axis;
        this.hoveredAxis = axis;
        this.#applyAxisColors();

        if (axis === 'start') {
            this.dragFixedPoint.set(road.endX, 0, road.endZ);
        } else {
            this.dragFixedPoint.set(road.startX, 0, road.startZ);
        }

        event.preventDefault();
        event.stopPropagation();
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
            this.domElement.style.cursor = axis ? 'pointer' : this.resolveDefaultCursor();
            return false;
        }

        this.raycaster.setFromCamera(this.pointerToNdc(event), this.camera);
        if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.tempRayHit)) return false;

        const snapped = this.defaultSnapping(this.tempRayHit, 0);
        const draggedX = snapped?.x ?? this.tempRayHit.x;
        const draggedZ = snapped?.z ?? this.tempRayHit.z;

        const fixedX = this.dragFixedPoint.x;
        const fixedZ = this.dragFixedPoint.z;

        let startX = fixedX;
        let startZ = fixedZ;
        let endX = fixedX;
        let endZ = fixedZ;

        if (this.activeAxis === 'start') {
            startX = draggedX;
            startZ = draggedZ;
        } else {
            endX = draggedX;
            endZ = draggedZ;
        }

        const dx = endX - startX;
        const dz = endZ - startZ;
        const length = Math.max(MIN_ROAD_LENGTH, Math.hypot(dx, dz));
        if (length < MIN_ROAD_LENGTH) return false;

        const angle = Math.atan2(-dz, dx);

        this.onRoadMoved?.(startX, startZ, angle);
        this.onRoadResized?.(length);

        event.preventDefault();
        event.stopPropagation();
        this.#positionHandlesFromRoad();
        return true;
    }

    onPointerUp(event?: PointerEvent) {
        if (!this.activeAxis) return;
        event?.preventDefault();
        event?.stopPropagation();
        this.activeAxis = undefined;
        this.#applyAxisColors();
        this.#positionHandlesFromRoad();
        this.onDraggingChanged?.(false);
        this.domElement.style.cursor = this.hoveredAxis ? 'pointer' : this.resolveDefaultCursor();
    }

    #positionHandlesFromRoad() {
        const road = this.selected ? this.getSelectedRoadHandle?.() : undefined;
        if (!road) {
            this.root.visible = false;
            return;
        }

        this.root.visible = true;
        const startHandle = this.root.getObjectByName('startHandle');
        const endHandle = this.root.getObjectByName('endHandle');

        if (startHandle) {
            startHandle.position.set(road.startX, HANDLE_Y, road.startZ);
            startHandle.rotation.set(0, road.angle, 0);
        }

        if (endHandle) {
            endHandle.position.set(road.endX, HANDLE_Y, road.endZ);
            endHandle.rotation.set(0, road.angle, 0);
        }

        const startDistance = this.camera.position.distanceTo(new THREE.Vector3(road.startX, HANDLE_Y, road.startZ));
        const endDistance = this.camera.position.distanceTo(new THREE.Vector3(road.endX, HANDLE_Y, road.endZ));
        const startScale = Math.max(0.8, startDistance * 0.015);
        const endScale = Math.max(0.8, endDistance * 0.015);
        if (startHandle) startHandle.scale.setScalar(startScale);
        if (endHandle) endHandle.scale.setScalar(endScale);
    }

    #pickAxisAtPointer(event: PointerEvent): RoadHandleAxis | undefined {
        this.raycaster.setFromCamera(this.pointerToNdc(event), this.camera);
        const hits = this.raycaster.intersectObjects(this.root.children, true);
        if (hits.length === 0) return undefined;

        let axis = hits[0].object.userData?.axis as RoadHandleAxis | undefined;
        if (!axis && hits[0].object.parent) {
            axis = hits[0].object.parent.userData?.axis as RoadHandleAxis | undefined;
        }
        return axis;
    }

    #applyAxisColors() {
        const dragging = !!this.activeAxis;
        (['start', 'end'] as RoadHandleAxis[]).forEach((axis) => {
            const material = this.axisMaterials[axis];
            const isActive = this.activeAxis === axis;
            const isHovered = this.hoveredAxis === axis;
            material.opacity = dragging ? 0.65 : 0.95;
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

        const startHandle = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.6), this.axisMaterials.start);
        startHandle.name = 'startHandle';
        startHandle.userData.axis = 'start';
        startHandle.renderOrder = 1002;

        const endHandle = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.6), this.axisMaterials.end);
        endHandle.name = 'endHandle';
        endHandle.userData.axis = 'end';
        endHandle.renderOrder = 1002;

        this.root.add(startHandle, endHandle);
        this.scene.add(this.root);
        this.#applyAxisColors();
    }
}
