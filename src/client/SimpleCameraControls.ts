import * as THREE from 'three';

const MIN_RADIUS = 10;
const MAX_RADIUS = 800;
const MIN_POLAR_ANGLE = THREE.MathUtils.degToRad(30);
const MAX_POLAR_ANGLE = THREE.MathUtils.degToRad(80);
const ROTATE_SPEED = 0.008;
const ZOOM_BASE = 0.0015;

type MouseAction = number | undefined;

export class SimpleCameraControls {
    readonly target = new THREE.Vector3();

    enabled = true;
    zoomSpeed = 2.5;
    useMiddlePivotPanForRotate = true;
    mouseButtons: { LEFT: MouseAction; MIDDLE: MouseAction; RIGHT: MouseAction } = {
        LEFT: undefined,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN,
    };
    onRotateAnchorChanged?: (position: THREE.Vector3) => void;
    onRotateAnchorEnded?: () => void;

    private readonly spherical = new THREE.Spherical();
    private readonly offset = new THREE.Vector3();
    private readonly raycaster = new THREE.Raycaster();
    private readonly pointer = new THREE.Vector2();
    private readonly panAnchor = new THREE.Vector3();
    private readonly panPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private readonly rotateAnchor = new THREE.Vector3();
    private readonly rotateAnchorPointer = new THREE.Vector2();
    private readonly rotateCurrentHit = new THREE.Vector3();
    private readonly rotateGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private readonly rotatePanDelta = new THREE.Vector3();

    private activePointerButton: number | null = null;
    private activeMouseAction: MouseAction = undefined;
    private hasRotateAnchor = false;
    private isHoverPanning = false;

    constructor(
        readonly camera: THREE.PerspectiveCamera,
        readonly domElement: HTMLElement,
        readonly scene?: THREE.Scene,
    ) {
        this.updateSphericalFromCamera();
        this.update();
    }

    update() {
        this.offset.setFromSpherical(this.spherical);
        this.camera.position.copy(this.target).add(this.offset);
        this.camera.lookAt(this.target);
        this.camera.updateMatrixWorld();
    }

    rotateBy(deltaX: number, deltaY: number) {
        if (!this.enabled) return;

        this.spherical.theta -= deltaX * ROTATE_SPEED;
        this.spherical.phi = THREE.MathUtils.clamp(
            this.spherical.phi - deltaY * ROTATE_SPEED,
            MIN_POLAR_ANGLE,
            MAX_POLAR_ANGLE
        );
        this.update();
    }

    panBy(delta: THREE.Vector3) {
        if (!this.enabled) return;

        this.target.add(delta);
        this.camera.position.add(delta);
        this.updateSphericalFromCamera();
        this.update();
    }

    dispose() {
        this.#endInteraction();
    }

    handlePointerDown(event: PointerEvent) {
        this.#onPointerDown(event);
    }

    handlePointerMove(event: PointerEvent) {
        this.#onPointerMove(event);
    }

    handlePointerUp() {
        this.#onPointerUp();
    }

    handleWindowPointerUp() {
        this.#onWindowPointerUp();
    }

    handleWheel(event: WheelEvent) {
        this.#onWheel(event);
    }

    handleContextMenu(event: MouseEvent) {
        this.#onContextMenu(event);
    }

    beginHoverPan(event: PointerEvent): boolean {
        if (!this.enabled) return false;
        const ok = this.#intersectPanPlane(event, this.panAnchor);
        this.isHoverPanning = ok;
        return ok;
    }

    moveHoverPan(event: PointerEvent): void {
        if (!this.enabled || !this.isHoverPanning) return;

        const currentHit = new THREE.Vector3();
        if (!this.#intersectPanPlane(event, currentHit)) return;

        const delta = new THREE.Vector3(
            this.panAnchor.x - currentHit.x,
            0,
            this.panAnchor.z - currentHit.z,
        );
        if (delta.lengthSq() === 0) return;

        this.panBy(delta);
    }

    endHoverPan(): void {
        this.isHoverPanning = false;
    }

    updateSphericalFromCamera() {
        this.offset.copy(this.camera.position).sub(this.target);
        this.spherical.setFromVector3(this.offset);
        this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius, MIN_RADIUS, MAX_RADIUS);
        this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi, MIN_POLAR_ANGLE, MAX_POLAR_ANGLE);
    }

    #eventToPointer(event: PointerEvent | WheelEvent) {
        const rect = this.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    #intersectPanPlane(event: PointerEvent, out: THREE.Vector3): boolean {
        this.#eventToPointer(event);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        this.panPlane.constant = -this.target.y;
        return this.raycaster.ray.intersectPlane(this.panPlane, out) !== null;
    }

    #getMouseAction(button: number): MouseAction {
        if (button === 0) return this.mouseButtons.LEFT;
        if (button === 1) return this.mouseButtons.MIDDLE;
        if (button === 2) return this.mouseButtons.RIGHT;
        return undefined;
    }

    #isButtonStillPressed(event: PointerEvent): boolean {
        if (this.activePointerButton === 0) return (event.buttons & 1) !== 0;
        if (this.activePointerButton === 1) return (event.buttons & 4) !== 0;
        if (this.activePointerButton === 2) return (event.buttons & 2) !== 0;
        return false;
    }

    #resolveRotateAnchor(event: PointerEvent): boolean {
        this.#eventToPointer(event);
        this.rotateAnchorPointer.copy(this.pointer);
        this.raycaster.setFromCamera(this.pointer, this.camera);

        if (this.scene) {
            const sceneHits = this.raycaster.intersectObjects(this.scene.children, true);
            if (sceneHits.length > 0) {
                this.rotateAnchor.copy(sceneHits[0].point);
                this.hasRotateAnchor = true;
                this.onRotateAnchorChanged?.(this.rotateAnchor);
                return true;
            }
        }

        if (!this.raycaster.ray.intersectPlane(this.rotateGroundPlane, this.rotateAnchor)) {
            this.hasRotateAnchor = false;
            return false;
        }

        this.hasRotateAnchor = true;
        this.onRotateAnchorChanged?.(this.rotateAnchor);
        return true;
    }

    #endInteraction() {
        if (this.hasRotateAnchor) {
            this.onRotateAnchorEnded?.();
        }
        this.activePointerButton = null;
        this.activeMouseAction = undefined;
        this.hasRotateAnchor = false;
    }

    #keepRotateAnchorOnScreen() {
        if (!this.hasRotateAnchor) return;

        this.raycaster.setFromCamera(this.rotateAnchorPointer, this.camera);
        this.panPlane.constant = -this.rotateAnchor.y;
        if (!this.raycaster.ray.intersectPlane(this.panPlane, this.rotateCurrentHit)) return;

        this.rotatePanDelta.set(
            this.rotateAnchor.x - this.rotateCurrentHit.x,
            0,
            this.rotateAnchor.z - this.rotateCurrentHit.z,
        );

        if (this.rotatePanDelta.lengthSq() === 0) return;
        this.panBy(this.rotatePanDelta);
    }

    #onPointerDown = (event: PointerEvent) => {
        if (!this.enabled) return;

        this.isHoverPanning = false;

        const mouseAction = this.#getMouseAction(event.button);
        if (mouseAction == null) return;

        this.activePointerButton = event.button;
        this.activeMouseAction = mouseAction;

        if (mouseAction === THREE.MOUSE.PAN) {
            if (!this.#intersectPanPlane(event, this.panAnchor)) {
                this.#endInteraction();
                return;
            }
            return;
        }

        if (mouseAction === THREE.MOUSE.ROTATE && event.button === 1 && this.useMiddlePivotPanForRotate) {
            if (!this.#resolveRotateAnchor(event)) {
                this.#endInteraction();
                return;
            }
            return;
        }
    };

    #onPointerMove = (event: PointerEvent) => {
        if (!this.enabled || this.activePointerButton == null || this.activeMouseAction == null) return;
        if (!this.#isButtonStillPressed(event)) {
            this.#endInteraction();
            return;
        }

        if (this.activeMouseAction === THREE.MOUSE.ROTATE) {
            if (this.activePointerButton === 1 && this.useMiddlePivotPanForRotate) {
                this.rotateBy(event.movementX, event.movementY);
                this.#keepRotateAnchorOnScreen();
                return;
            }

            this.rotateBy(event.movementX, event.movementY);
            return;
        }

        if (this.activeMouseAction !== THREE.MOUSE.PAN) return;

        const currentHit = new THREE.Vector3();
        if (!this.#intersectPanPlane(event, currentHit)) return;

        const delta = new THREE.Vector3(
            this.panAnchor.x - currentHit.x,
            0,
            this.panAnchor.z - currentHit.z,
        );
        if (delta.lengthSq() === 0) return;

        this.panBy(delta);
    };

    #onPointerUp = () => {
        this.isHoverPanning = false;
        this.#endInteraction();
    };

    #onWindowPointerUp = () => {
        this.isHoverPanning = false;
        this.#endInteraction();
    };

    #onWheel = (event: WheelEvent) => {
        if (!this.enabled) return;
        event.preventDefault();

        const factor = Math.exp(event.deltaY * ZOOM_BASE * this.zoomSpeed);
        this.spherical.radius = THREE.MathUtils.clamp(
            this.spherical.radius * factor,
            MIN_RADIUS,
            MAX_RADIUS
        );
        this.update();
    };

    #onContextMenu = (event: MouseEvent) => {
        event.preventDefault();
    };
}
