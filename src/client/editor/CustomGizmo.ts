import * as THREE from 'three';

const SLOPE_1_2 = Math.atan2(1, 2);
const SLOPE_1_2_DELTA = SLOPE_1_2 - Math.PI / 8;
const GRID_SNAP = 5;
export const ROAD_SNAP = 1;
const SECTOR_ANGLE = Math.PI / 8;

export type IRoadHandle = {
    startX: number;
    startZ: number;
    endX: number;
    endZ: number;
    angle: number;
    length: number;
    midX?: number;
    midZ?: number;
};

export type ICustomGizmoProps = {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    raycaster?: THREE.Raycaster;
    domElement: HTMLCanvasElement;
    onDraggingChanged?: (dragging: boolean) => void;
};

export abstract class CustomGizmo {
    protected readonly scene: THREE.Scene;
    protected readonly camera: THREE.PerspectiveCamera;
    protected readonly raycaster: THREE.Raycaster;
    protected readonly domElement: HTMLCanvasElement;
    protected readonly root = new THREE.Group();
    protected readonly onDraggingChanged?: (dragging: boolean) => void;

    getDefaultCursor?: () => string;

    constructor(props: ICustomGizmoProps) {
        this.scene = props.scene;
        this.camera = props.camera;
        this.raycaster = props.raycaster ?? new THREE.Raycaster();
        this.domElement = props.domElement;
        this.onDraggingChanged = props.onDraggingChanged;
        this.domElement.style.touchAction = 'none';
    }

    protected resolveDefaultCursor(): string {
        return this.getDefaultCursor?.() ?? '';
    }

    protected pointerToNdc(event: PointerEvent): THREE.Vector2 {
        const rect = this.domElement.getBoundingClientRect();
        return new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
    }

    defaultSnapping(position: THREE.Vector3, rotationY: number, snap: number = GRID_SNAP): { x: number; z: number; angle: number } | undefined {
        const activeEvent = typeof window !== 'undefined' ? window.event : undefined;
        if (activeEvent && 'shiftKey' in activeEvent) {
            const eventWithModifiers = activeEvent as MouseEvent | KeyboardEvent;
            if (eventWithModifiers.shiftKey) {
                return { x: position.x, z: position.z, angle: rotationY };
            }
        }

        let x = position.x;
        let z = position.z;

        const xi = Math.round(x / snap);
        const zi = Math.round(z / snap);
        x = xi * snap;
        z = zi * snap;

        const sector = Math.round(rotationY / SECTOR_ANGLE);
        const type = ((sector % 4) + 4) % 4;
        let angle = sector * SECTOR_ANGLE;

        switch (type) {
            case 1:
                angle += SLOPE_1_2_DELTA;
                break;
            case 3:
                angle -= SLOPE_1_2_DELTA;
                break;
        }

        return { x, z, angle };
    }

    update() {
    }

    setVisible(visible: boolean) {
        this.root.visible = visible;
        if (!visible) {
            this.domElement.style.cursor = this.resolveDefaultCursor();
        }
    }

    abstract onPointerDown(event: PointerEvent): boolean;
    abstract onPointerMove(event: PointerEvent): boolean;
    abstract onPointerUp(event?: PointerEvent): void;
}
