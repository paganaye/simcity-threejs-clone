import * as THREE from 'three';
import { CustomGizmo, ROAD_SNAP, type ICustomGizmoProps, type IRoadHandle } from './CustomGizmo';

type RoadHandleAxis = 'start' | 'end' | 'arc';
type ArcRelative = {
    t: number;
    offsetRatio: number;
};

export type IRoadGizmoProps = ICustomGizmoProps;

const HANDLE_Y = 0.12;

export class RoadGizmo extends CustomGizmo {
    getSelectedRoadHandle?: () => IRoadHandle | undefined;
    onRoadMoved?: (x: number, z: number, angle: number) => void;
    onRoadResized?: (newLength: number) => void;
    onArcChanged?: (midX: number, midZ: number) => void;
    onDeselect?: () => void;
    onDragEnded?: () => void;
    private selectedHandle?: IRoadHandle;

    private readonly axisMaterials: Record<RoadHandleAxis, THREE.MeshBasicMaterial>;
    private readonly axisBaseColors: Record<RoadHandleAxis, THREE.Color> = {
        start: new THREE.Color(0x55a8ff),
        end: new THREE.Color(0x44ff44),
        arc: new THREE.Color(0xff9f1c),
    };
    // Arc control point tracked internally during drag so visual updates are immediate.
    private readonly internalArcPos = new THREE.Vector2();
    private hasInternalArcPos = false;
    private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private readonly tempRayHit = new THREE.Vector3();
    private readonly dragFixedPoint = new THREE.Vector3();
    private dragArcRelative?: ArcRelative;
    private activeAxis?: RoadHandleAxis;
    private hoveredAxis?: RoadHandleAxis;
    private selected = false;

    constructor(props: IRoadGizmoProps) {
        super(props);

        this.axisMaterials = {
            start: new THREE.MeshBasicMaterial({ color: this.axisBaseColors.start, depthTest: false, transparent: true, opacity: 0.95 }),
            end: new THREE.MeshBasicMaterial({ color: this.axisBaseColors.end, depthTest: false, transparent: true, opacity: 0.95 }),
            arc: new THREE.MeshBasicMaterial({ color: this.axisBaseColors.arc, depthTest: false, transparent: true, opacity: 0.95 }),
        };

        this.#build();
    }

    setRoadSelection(handle: IRoadHandle): void {
        this.selected = true;
        this.selectedHandle = handle;
        this.hasInternalArcPos = false;
        this.setVisible(true);
        this.#positionHandlesFromRoad();
    }

    clearSelection(): void {
        this.selected = false;
        this.selectedHandle = undefined;
        this.dragArcRelative = undefined;
        this.hasInternalArcPos = false;
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

    /**
     * Programmatically start dragging the end handle — used when a new road
     * is created interactively so the draw and gizmo-drag paths share one code path.
     */
    beginEndDrag(event: PointerEvent): void {
        const road = this.getSelectedRoadHandle?.() ?? this.selectedHandle;
        if (!road) return;

        this.raycaster.setFromCamera(this.pointerToNdc(event), this.camera);
        if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.tempRayHit)) return;

        this.activeAxis = 'end';
        this.hoveredAxis = 'end';
        this.dragFixedPoint.set(road.startX, 0, road.startZ);
        this.dragArcRelative = undefined;
        this.#applyAxisColors();
        this.onDraggingChanged?.(true);
        this.domElement.style.cursor = 'grabbing';
    }

    onPointerDown(event: PointerEvent): boolean {
        if (!this.root.visible) return false;

        const axis = this.#pickAxisAtPointer(event);
        if (!axis) return false;

        const road = this.getSelectedRoadHandle?.() ?? this.selectedHandle;
        if (!road) return false;

        this.raycaster.setFromCamera(this.pointerToNdc(event), this.camera);
        if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.tempRayHit)) return false;

        this.activeAxis = axis;
        this.hoveredAxis = axis;
        this.#applyAxisColors();

        if (axis === 'start') {
            this.dragFixedPoint.set(road.endX, 0, road.endZ);
            this.dragArcRelative = this.#toArcRelative(road);
        } else if (axis === 'end') {
            this.dragFixedPoint.set(road.startX, 0, road.startZ);
            this.dragArcRelative = this.#toArcRelative(road);
        } else {
            this.dragArcRelative = undefined;
        }
        // arc: no fixed anchor needed, follows mouse freely

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

        if (this.activeAxis === 'arc') {
            this.internalArcPos.set(this.tempRayHit.x, this.tempRayHit.z);
            this.hasInternalArcPos = true;
            this.onArcChanged?.(this.tempRayHit.x, this.tempRayHit.z);
            event.preventDefault();
            event.stopPropagation();
            this.#positionHandlesFromRoad();
            return true;
        }

        const snapped = this.defaultSnapping(this.tempRayHit, 0, ROAD_SNAP);
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
        const length = Math.hypot(dx, dz);

        const angle = Math.atan2(-dz, dx);

        this.onRoadMoved?.(startX, startZ, angle);
        this.onRoadResized?.(length);

        if (this.dragArcRelative) {
            const projected = this.#fromArcRelative(startX, startZ, endX, endZ, this.dragArcRelative);
            if (projected) {
                this.internalArcPos.set(projected.midX, projected.midZ);
                this.hasInternalArcPos = true;
                this.onArcChanged?.(projected.midX, projected.midZ);
            } else {
                this.hasInternalArcPos = false;
            }
        } else {
            this.hasInternalArcPos = false;
        }

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
        this.dragArcRelative = undefined;
        this.#applyAxisColors();
        this.#positionHandlesFromRoad();
        this.onDraggingChanged?.(false);
        this.onDragEnded?.();
        this.domElement.style.cursor = this.hoveredAxis ? 'pointer' : this.resolveDefaultCursor();
    }

    #toArcRelative(road: IRoadHandle): ArcRelative | undefined {
        if (road.midX === undefined || road.midZ === undefined) return undefined;

        const dx = road.endX - road.startX;
        const dz = road.endZ - road.startZ;
        const length = Math.hypot(dx, dz);
        if (length < 1e-6) return undefined;

        const ux = dx / length;
        const uz = dz / length;
        const nx = -uz;
        const nz = ux;

        const mx = road.midX - road.startX;
        const mz = road.midZ - road.startZ;

        const along = mx * ux + mz * uz;
        const perp = mx * nx + mz * nz;

        return {
            t: THREE.MathUtils.clamp(along / length, 0, 1),
            offsetRatio: perp / length,
        };
    }

    #fromArcRelative(startX: number, startZ: number, endX: number, endZ: number, relative: ArcRelative): { midX: number; midZ: number } | undefined {
        const dx = endX - startX;
        const dz = endZ - startZ;
        const length = Math.hypot(dx, dz);
        if (length < 1e-6) return undefined;

        const ux = dx / length;
        const uz = dz / length;
        const nx = -uz;
        const nz = ux;
        const along = relative.t * length;
        const perp = relative.offsetRatio * length;

        return {
            midX: startX + ux * along + nx * perp,
            midZ: startZ + uz * along + nz * perp,
        };
    }

    #positionHandlesFromRoad() {
        const road = this.selected ? (this.getSelectedRoadHandle?.() ?? this.selectedHandle) : undefined;
        if (!road) {
            this.root.visible = false;
            return;
        }

        this.root.visible = true;
        const startHandle = this.root.getObjectByName('startHandle');
        const endHandle = this.root.getObjectByName('endHandle');
        const arcHandle = this.root.getObjectByName('arcHandle');

        if (startHandle) {
            startHandle.position.set(road.startX, HANDLE_Y, road.startZ);
            startHandle.rotation.set(0, road.angle, 0);
            const d = this.camera.position.distanceTo(startHandle.position);
            startHandle.scale.setScalar(Math.max(0.8, d * 0.015));
        }

        if (endHandle) {
            endHandle.position.set(road.endX, HANDLE_Y, road.endZ);
            endHandle.rotation.set(0, road.angle, 0);
            const d = this.camera.position.distanceTo(endHandle.position);
            endHandle.scale.setScalar(Math.max(0.8, d * 0.015));
        }

        if (arcHandle) {
            let midX: number;
            let midZ: number;
            if (this.hasInternalArcPos) {
                midX = this.internalArcPos.x;
                midZ = this.internalArcPos.y;
            } else if (road.midX !== undefined && road.midZ !== undefined) {
                midX = road.midX;
                midZ = road.midZ;
            } else {
                midX = (road.startX + road.endX) / 2;
                midZ = (road.startZ + road.endZ) / 2;
            }
            arcHandle.position.set(midX, HANDLE_Y, midZ);
            const d = this.camera.position.distanceTo(arcHandle.position);
            arcHandle.scale.setScalar(Math.max(0.8, d * 0.015));
        }
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
        (['start', 'end', 'arc'] as RoadHandleAxis[]).forEach((axis) => {
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

        const startHandle = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), this.axisMaterials.start);
        startHandle.name = 'startHandle';
        startHandle.userData.axis = 'start';
        startHandle.renderOrder = 1002;

        const endHandle = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), this.axisMaterials.end);
        endHandle.name = 'endHandle';
        endHandle.userData.axis = 'end';
        endHandle.renderOrder = 1002;

        // Diamond (lozenge) for arc control — a square box rotated 45° on Y.
        const arcHandle = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), this.axisMaterials.arc);
        arcHandle.rotation.y = Math.PI / 4;
        arcHandle.name = 'arcHandle';
        arcHandle.userData.axis = 'arc';
        arcHandle.renderOrder = 1002;

        this.root.add(startHandle, endHandle, arcHandle);
        this.scene.add(this.root);
        this.#applyAxisColors();
    }
}
