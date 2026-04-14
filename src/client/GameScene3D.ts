import * as THREE from 'three';
import { AssetManager } from "./AssetManager"
import { WorldMap3D } from './WorldMap3D';
import { SimBridge } from '../sim/SimBridge';
import { Cars3D } from './cars/Cars3D';
import { ICityChanged } from '../sim/Init';
import { Painter } from '../sim/Painter';
import GUI from 'lil-gui';
import { Page } from './Page';
import { IFloorSize } from './GameUIComponent';
import { RoadGizmo, RoadHandleAxis } from './editor/RoadGizmo';
import type { CustomGizmo } from './editor/CustomGizmo';
import { ObjectGizmo } from './editor/ObjectGizmo';
import { RoadSegment, SegmentSide } from './roads/RoadSegment';
import { ToolController } from './tools/ToolController';
import { RoadToolController } from './tools/RoadToolController';
import { BulldozerToolController } from './tools/BulldozerToolController';
import { SelectToolController } from './tools/SelectToolController';
import { ActiveTool } from './tools/ToolTypes';
import { Signal } from './Signal';
import type { IDualRoadType } from './roads/IRoad';
import { RoadNetwork } from './roads/RoadNetwork';
import { ISelectedObject } from './editor/ISelectedObject';

export type ILeftPointerGesture = {
    downX: number;
    downY: number;
    moved: boolean;
    consumedByGizmo: boolean;
    currentX: number;
    currentY: number;
};

export class GameScene3D {
    assetManager: AssetManager = new AssetManager(this)
    worldMap3D!: WorldMap3D;
    cars3D!: Cars3D;
    //cameraManager!: CameraManager;
    //inputManager!: InputManager;
    sim = new SimBridge().createCaller();
    renderer!: THREE.WebGLRenderer;
    scene!: THREE.Scene;
    raycaster!: THREE.Raycaster;
    grid?: THREE.Mesh;
    overlay?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>;
    painter!: Painter;
    gui?: GUI;
    camera!: THREE.PerspectiveCamera;
    container!: HTMLElement;
    renderDom?: HTMLCanvasElement;
    readonly tempMatrix = new THREE.Matrix4();
    readonly tempPosition = new THREE.Vector3();
    readonly tempQuaternion = new THREE.Quaternion();
    readonly tempScale = new THREE.Vector3();
    page?: Page;
    objectGizmo!: ObjectGizmo;
    roadGizmo!: RoadGizmo;
    currentGizmo?: CustomGizmo;
    readonly transformProxy = new THREE.Object3D();
    selectionHalo?: THREE.Group;
    readonly selectionHaloLayers: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>[] = [];
    lastTransformValid = true;
    isCustomGizmoSelectableObject?: (obj: THREE.Object3D) => boolean;
    onCustomGizmoObjectSelected?: (obj: THREE.Object3D) => void;
    readonly tempWorldMatrix = new THREE.Matrix4();
    readonly tempBox = new THREE.Box3();
    readonly tempSize = new THREE.Vector3();
    readonly tempCenter = new THREE.Vector3();
    readonly tempCenterWorld = new THREE.Vector3();
    isLeftPointerDown = false;
    leftPointerDownMoved = false;
    leftPointerDownConsumedByGizmo = false;
    leftPointerDownPanMode = false;
    isSpaceHoverPanning = false;
    leftPointerDownX = 0;
    leftPointerDownY = 0;
    isSpacePanModifierDown = false;
    /** Called by the road gizmo after each resize (drag of end handle). */
    onRoadSegmentResized?: (segment: RoadSegment) => void;
    readonly roadNetwork = new RoadNetwork(this);
    private currentToolController?: ToolController;
    private readonly toolMap = new Map<ActiveTool, ToolController>();
    size: IFloorSize;
    isLoading = new Signal(true);
    isPaused = new Signal(false);
    activeTool = new Signal<ActiveTool>('select');
    selectedObject = new Signal<ISelectedObject | undefined>(undefined);
    simMoney = new Signal(0);
    population = new Signal(0);
    simTime = new Signal(0);
    cityName = new Signal('My City');

    lastSelectedRoad: IDualRoadType = {
        forward: { roadColor: 'old', lanes: 1, rightKerb: 'none', rightSidewalk: 'small', laneWidth: 'normal', leftKerb: 'none', leftSidewalk: 'none' },
        backward: { roadColor: 'old', lanes: 1, rightKerb: 'none', rightSidewalk: 'small', laneWidth: 'normal', leftKerb: 'none', leftSidewalk: 'none' },
        gapSize: 0,
    };

    constructor(readonly mapSize: IFloorSize) {
        this.size = mapSize;
    }

    async init(context: Page) {
        this.page = context;
        this.scene = context.scene;
        this.renderer = context.renderer;
        this.gui = context.gui!;
        this.camera = context.camera;
        this.container = context.appContainer;
        this.renderDom = context.renderer.domElement;

        let pendingAssetManager = this.assetManager.init()
        this.worldMap3D = new WorldMap3D(this);
        this.cars3D = new Cars3D(this)

        this.renderer = new THREE.WebGLRenderer({
            antialias: true
        });

        this.raycaster = new THREE.Raycaster();
        this.#setupLights();
        this.#setupSelectionHalo();
        this.#setupSelectionInput();
        this.#setupCustomGizmo(context);
        this.#setupToolControllers();
        this.#setupGround();
        await pendingAssetManager;
        this.isLoading.set(false);

        let changes = await this.sim.init();
        if (changes.cityChanged) {
            this.onCityChanged(changes.cityChanged);
        }
        if (changes.carChanged) {
            this.cars3D.onCarsChanged(changes.carChanged);
        }

    }

    onCityChanged(cityChanged: ICityChanged) {
        this.cityName.set(cityChanged.name);
        if (cityChanged.clear) this.worldMap3D.clearCity();
        //this.worldMap3D.setSize(cityChanged.width, cityChanged.height);

        const centerX = cityChanged.width / 2 - 0.5;
        const centerZ = cityChanged.height / 2 - 0.5;
        this.camera.lookAt(centerX, 0, centerZ);
        if (this.page?.cameraControls) {
            this.page.cameraControls.target.set(centerX, 0, centerZ);
            this.page.cameraControls.update();
        }

    }

    setActiveTool(tool: ActiveTool): void {
        this.activeTool.set(tool);
        this.currentToolController = this.toolMap.get(tool);
        this.currentToolController?.onToolChanged(tool);
    }

    #setupToolControllers(): void {
        const roadController = new RoadToolController(this);
        const bulldozeController = new BulldozerToolController(this);
        const selectController = new SelectToolController(this);

        this.toolMap.set('road', roadController);
        this.toolMap.set('bulldoze', bulldozeController);
        this.toolMap.set('select', selectController);

        this.isCustomGizmoSelectableObject = (obj) =>
            this.activeTool.get() !== 'bulldoze' && obj.userData?.selectableType === 'road';

        this.onRoadSegmentResized = (seg) => roadController.onRoadSegmentResized(seg);

        this.setActiveTool(this.activeTool.get());
    }

    #getSelectedRoadSegment(): RoadSegment | undefined {
        const selected = this.selectedObject.get();
        if (!selected) return undefined;
        return this.#getRoadSegmentFromObject(selected.object3D);
    }

    #getRoadSegmentFromObject(obj: THREE.Object3D | undefined): RoadSegment | undefined {
        if (!obj) return undefined;

        const directSegment = obj.userData?.roadSegment as RoadSegment | undefined;
        if (directSegment) {
            return directSegment;
        }

        const owner = obj.userData?.owner;
        if (!owner) {
            return undefined;
        }

        return this.roadNetwork.segments.find((segment) =>
            segment.forwardPrimitive === owner
            || segment.backwardPrimitive === owner
            || segment.startJoinArcPrimitive === owner
            || segment.endJoinArcPrimitive === owner
        );
    }

    #isSelectedBuilding(): boolean {
        const selected = this.selectedObject.get();
        return Boolean(
            selected
            && selected.object3D instanceof THREE.InstancedMesh
            && selected.instanceId != null
            && selected.object3D.userData?.selectableType === 'building'
        );
    }

    clearSelection(): void {
        delete this.scene.userData.roadSegment;
        this.selectedObject.set(undefined);
        this.currentGizmo = undefined;
        this.roadGizmo.clearSelection();
        this.objectGizmo.clearSelection();
        this.#updateSelectionHalo();
    }

    deleteCurrentSelection(): boolean {
        const selectedRoad = this.#getSelectedRoadSegment();
        if (selectedRoad) {
            this.roadNetwork.removeSegment(selectedRoad);
            this.clearSelection();
            return true;
        }

        const selected = this.selectedObject.get();
        if (selected && selected.object3D instanceof THREE.InstancedMesh && selected.instanceId != null && selected.object3D.userData?.selectableType === 'building') {
            const removed = this.worldMap3D.removeBuilding(selected.object3D, selected.instanceId);
            if (removed) {
                this.clearSelection();
                return true;
            }
        }

        return false;
    }

    selectRoadSegment(segment: RoadSegment | undefined): void {
        if (!segment) {
            this.clearSelection()
            return;
        }

        this.selectedObject.set({ kind: 'road', object3D: this.scene, roadSegment: segment });
        this.scene.userData.roadSegment = segment;
        this.currentGizmo = this.roadGizmo;
        this.objectGizmo.clearSelection();
        this.lastSelectedRoad = segment.getIRoad();
        this.roadGizmo.setRoadSelection({
            startX: segment.startX,
            startZ: segment.startZ,
            endX: segment.endX,
            endZ: segment.endZ,
            angle: segment.angle,
            length: segment.length,
            midX: segment.arcMidX,
            midZ: segment.arcMidZ,
        });
        this.#updateSelectionHalo();
    }

    selectAtScreenPoint(clientX: number, clientY: number): void {
        if (!this.renderDom) return;
        const rect = this.renderDom.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        );
        this.raycaster.setFromCamera(mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.scene.children, true);

        let selected: ISelectedObject | undefined;
        let selectedRoadSegment: RoadSegment | undefined;
        for (const hit of hits) {
            if (hit.object === this.transformProxy) continue;
            const roadSegment = this.#getRoadSegmentFromObject(hit.object);
            if (roadSegment) {
                selectedRoadSegment = roadSegment;
                break;
            }

            const selectableType = hit.object.userData?.selectableType as ('building' | 'character' | 'road' | undefined);
            if (!selectableType) continue;
            if (selectableType === 'road') continue;
            if (hit.instanceId == null) continue;
            const obj = hit.object as THREE.InstancedMesh;
            selected = {
                kind: selectableType === 'character' ? 'character' : 'building',
                object3D: obj,
                instanceId: hit.instanceId,
            };
            break;
        }

        if (selectedRoadSegment) {
            this.selectRoadSegment(selectedRoadSegment);
        } else {
            this.#selectObject(selected);
        }
    }

    #selectObject(selected: ISelectedObject | undefined): void {
        this.roadGizmo.clearSelection();
        this.selectedObject.set(selected);

        if (this.#isSelectedBuilding()) {
            this.currentGizmo = this.objectGizmo;
            this.objectGizmo.syncSelectionFromSelectedObject();
        } else {
            this.currentGizmo = undefined;
            this.objectGizmo.clearSelection();
        }

        this.#updateSelectionHalo();
    }

    #setupGround() {
        if (this.grid) this.scene.remove(this.grid)
        let size = this.worldMap3D.size
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x4f9d3a,
            roughness: 0.95,
            metalness: 0.0
        });

        const grid = new THREE.Mesh(
            new THREE.PlaneGeometry(size.x, size.z),
            groundMaterial
        );
        grid.rotation.x = -Math.PI / 2;
        grid.position.set(size.x / 2 - 0.5, -0.05, size.z / 2 - 0.5);
        grid.receiveShadow = true;
        this.grid = grid;
        this.scene.add(grid);
    }

    #setupLights() {
        const sun = new THREE.DirectionalLight(0xffffff, 2)
        sun.position.set(-10, 20, 0);
        sun.castShadow = true;
        sun.shadow.camera.left = -20;
        sun.shadow.camera.right = 20;
        sun.shadow.camera.top = 20;
        sun.shadow.camera.bottom = -20;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 50;
        sun.shadow.normalBias = 0.01;
        this.scene.add(sun);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    }


    drawFrame(_elapsedTime: number) {
        let now = performance.now();
        this.cars3D?.drawFrame(now)
        this.worldMap3D?.drawFrame(now)
        this.currentGizmo?.update();
        this.#updateSelectionHalo();
    }

    #setupSelectionHalo() {
        const haloGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
        const halo = new THREE.Group();

        const opacities = [0.95, 0.6, 0.35];
        this.selectionHaloLayers.length = 0;
        for (const opacity of opacities) {
            const haloMaterial = new THREE.LineBasicMaterial({
                color: 0xff9f1c,
                transparent: true,
                opacity,
                depthTest: false,
            });
            const layer = new THREE.LineSegments(haloGeometry, haloMaterial);
            layer.renderOrder = 1000;
            this.selectionHaloLayers.push(layer);
            halo.add(layer);
        }

        this.selectionHalo = halo;
        this.selectionHalo.visible = false;
        this.scene.add(this.selectionHalo);
    }

    #updateSelectionHalo() {
        if (!this.selectionHalo) return;

        const selected = this.selectedObject.get();
        if (!selected || !(selected.object3D instanceof THREE.InstancedMesh) || selected.instanceId == null || selected.object3D.userData?.selectableType !== 'building') {
            this.selectionHalo.visible = false;
            return;
        }

        const geometry = selected.object3D.geometry;
        if (!geometry?.boundingBox) {
            geometry?.computeBoundingBox();
        }

        if (!geometry?.boundingBox) {
            this.selectionHalo.visible = false;
            return;
        }

        selected.object3D.getMatrixAt(selected.instanceId, this.tempMatrix);
        this.tempWorldMatrix.multiplyMatrices(selected.object3D.matrixWorld, this.tempMatrix);
        this.tempWorldMatrix.decompose(this.tempPosition, this.tempQuaternion, this.tempScale);

        this.tempBox.copy(geometry.boundingBox);
        this.tempBox.getSize(this.tempSize);
        this.tempBox.getCenter(this.tempCenter);

        const sx = Math.abs(this.tempScale.x);
        const sy = Math.abs(this.tempScale.y);
        const sz = Math.abs(this.tempScale.z);
        const inflate = 1.05;

        this.tempCenterWorld.copy(this.tempCenter);
        this.tempCenterWorld.multiply(this.tempScale);
        this.tempCenterWorld.applyQuaternion(this.tempQuaternion);
        this.tempCenterWorld.add(this.tempPosition);

        this.selectionHalo.position.copy(this.tempCenterWorld);
        this.selectionHalo.quaternion.copy(this.tempQuaternion);

        const baseX = Math.max(this.tempSize.x * sx * inflate, 0.1);
        const baseY = Math.max(this.tempSize.y * sy * inflate, 0.1);
        const baseZ = Math.max(this.tempSize.z * sz * inflate, 0.1);
        const layerMultipliers = [1, 1.025, 1.05];

        this.selectionHaloLayers.forEach((layer, index) => {
            const m = layerMultipliers[index] ?? 1;
            layer.scale.set(baseX * m, baseY * m, baseZ * m);
        });

        this.selectionHalo.visible = true;
    }

    #setupSelectionInput() {
        const updateSpacePanBinding = () => {
            const controls = this.page?.cameraControls;
            if (!controls) return;
            controls.mouseButtons.LEFT = this.isSpacePanModifierDown ? THREE.MOUSE.PAN : undefined;
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (this.#isEditableElement(event.target)) {
                return;
            }

            const consumedByTools = this.#dispatchToolKeyDown(event);
            if (consumedByTools) {
                event.preventDefault();
                return;
            }

            if (event.code === 'Space') { // Space bar
                this.isSpacePanModifierDown = true;
                updateSpacePanBinding();
                this.isSpaceHoverPanning = false;
                event.preventDefault();
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.code === 'Space') { // Space bar
                this.isSpacePanModifierDown = false;
                this.isSpaceHoverPanning = false;
                this.page?.cameraControls?.endHoverPan();
                updateSpacePanBinding();
                event.preventDefault();
                return;
            }

            if (this.#isEditableElement(event.target)) {
                return;
            }

            const consumedByTools = this.#dispatchToolKeyUp(event);
            if (consumedByTools) {
                event.preventDefault();
            }
        };

        const handleWindowBlur = () => {
            this.isSpacePanModifierDown = false;
            this.leftPointerDownPanMode = false;
            this.isSpaceHoverPanning = false;
            this.page?.cameraControls?.endHoverPan();
            updateSpacePanBinding();
            this.page?.cameraControls?.handlePointerUp();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleWindowBlur);

        this.renderDom?.addEventListener('pointerdown', (event) => {
            if (!this.renderDom) return;

            const controls = this.page?.cameraControls;
            if (event.button !== 0) {
                controls?.handlePointerDown(event);
                return;
            }

            if (this.isSpacePanModifierDown) {
                this.leftPointerDownPanMode = true;
                controls?.handlePointerDown(event);
                event.preventDefault();
                return;
            }

            this.isLeftPointerDown = true;
            this.leftPointerDownMoved = false;
            this.leftPointerDownConsumedByGizmo = false;
            this.leftPointerDownPanMode = false;
            this.leftPointerDownX = event.clientX;
            this.leftPointerDownY = event.clientY;

            this.leftPointerDownConsumedByGizmo = this.currentGizmo?.onPointerDown(event) ?? false;
            if (this.leftPointerDownConsumedByGizmo) {
                event.stopPropagation();
                event.preventDefault();
            } else {
                this.currentToolController?.onPointerDown(event, {
                    downX: this.leftPointerDownX,
                    downY: this.leftPointerDownY,
                    moved: this.leftPointerDownMoved,
                    consumedByGizmo: this.leftPointerDownConsumedByGizmo,
                    currentX: event.clientX,
                    currentY: event.clientY,
                });
                controls?.handlePointerDown(event);
            }
        });

        this.renderDom?.addEventListener('pointermove', (event) => {
            const controls = this.page?.cameraControls;

            if (this.isSpacePanModifierDown && !this.leftPointerDownPanMode && !this.isLeftPointerDown && event.buttons === 0) {
                if (!this.isSpaceHoverPanning) {
                    this.isSpaceHoverPanning = controls?.beginHoverPan(event) ?? false;
                } else {
                    controls?.moveHoverPan(event);
                }
                event.preventDefault();
                return;
            }

            if (this.isSpaceHoverPanning) {
                this.isSpaceHoverPanning = false;
                controls?.endHoverPan();
            }

            if (this.leftPointerDownPanMode) {
                controls?.handlePointerMove(event);
                return;
            }

            if (this.isLeftPointerDown) {
                const dx = event.clientX - this.leftPointerDownX;
                const dy = event.clientY - this.leftPointerDownY;
                if ((dx * dx + dy * dy) > 9) {
                    this.leftPointerDownMoved = true;
                }
            }

            const gizmoHandledMove = this.currentGizmo?.onPointerMove(event)

            if (gizmoHandledMove) {
                //this.#onTransformChanged();
            } else {

                if (this.isLeftPointerDown) {
                    this.currentToolController?.onPointerMove(event, {
                        downX: this.leftPointerDownX,
                        downY: this.leftPointerDownY,
                        moved: this.leftPointerDownMoved,
                        consumedByGizmo: this.leftPointerDownConsumedByGizmo,
                        currentX: event.clientX,
                        currentY: event.clientY,
                    });
                }
                controls?.handlePointerMove(event);
            }
        });

        this.renderDom?.addEventListener('pointerup', (event) => {
            const controls = this.page?.cameraControls;

            if (this.leftPointerDownPanMode && event.button === 0) {
                this.leftPointerDownPanMode = false;
                this.isSpaceHoverPanning = false;
                controls?.endHoverPan();
                this.isLeftPointerDown = false;
                this.leftPointerDownMoved = false;
                this.leftPointerDownConsumedByGizmo = false;
                controls?.handlePointerUp();
                return;
            }

            this.currentGizmo?.onPointerUp(event);

            if (event.button === 0) {
                const gesture: ILeftPointerGesture = {
                    downX: this.leftPointerDownX,
                    downY: this.leftPointerDownY,
                    moved: this.leftPointerDownMoved,
                    consumedByGizmo: this.leftPointerDownConsumedByGizmo,
                    currentX: event.clientX,
                    currentY: event.clientY,
                };

                this.currentToolController?.onPointerUp(event, gesture);
                this.isLeftPointerDown = false;
                this.leftPointerDownMoved = false;
                this.leftPointerDownConsumedByGizmo = false;
            }

            controls?.handlePointerUp();
        });

        this.renderDom?.addEventListener('pointercancel', () => {
            const controls = this.page?.cameraControls;
            this.currentGizmo?.onPointerUp();
            this.currentToolController?.onPointerCancel();
            this.isLeftPointerDown = false;
            this.leftPointerDownMoved = false;
            this.leftPointerDownConsumedByGizmo = false;
            this.leftPointerDownPanMode = false;
            this.isSpaceHoverPanning = false;
            controls?.endHoverPan();
            controls?.handlePointerUp();
        });

        this.renderDom?.addEventListener('pointerleave', () => {
            this.isSpaceHoverPanning = false;
            this.page?.cameraControls?.endHoverPan();
            this.page?.cameraControls?.handlePointerUp();
        });

        this.renderDom?.addEventListener('wheel', (event) => {
            this.page?.cameraControls?.handleWheel(event);
        }, { passive: false });

        this.renderDom?.addEventListener('contextmenu', (event) => {
            this.page?.cameraControls?.handleContextMenu(event);
        });

        window.addEventListener('pointerup', () => {
            this.page?.cameraControls?.handleWindowPointerUp();
        });
    }

    #dispatchToolKeyDown(event: KeyboardEvent): boolean {
        if (this.currentToolController?.onKeyDown(event)) {
            return true;
        }

        for (const controller of this.toolMap.values()) {
            if (controller === this.currentToolController) continue;
            if (controller.onKeyDown(event)) {
                return true;
            }
        }

        return false;
    }

    #dispatchToolKeyUp(event: KeyboardEvent): boolean {
        if (this.currentToolController?.onKeyUp(event)) {
            return true;
        }

        for (const controller of this.toolMap.values()) {
            if (controller === this.currentToolController) continue;
            if (controller.onKeyUp(event)) {
                return true;
            }
        }

        return false;
    }

    #isEditableElement(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) return false;
        const tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    }

    #setupCustomGizmo(context: Page) {
        this.scene.add(this.transformProxy);
        this.objectGizmo = new ObjectGizmo({
            scene: this.scene,
            camera: this.camera,
            raycaster: this.raycaster,
            domElement: context.renderer.domElement,
            onPickSelectableAtPointer: (event) => this.pickSelectableAtPointer(event),
            getSelectedObject: () => this.selectedObject.get(),
            getInstanceYaw: (mesh, instanceId) => this.worldMap3D.getBuildingYaw(mesh, instanceId),
            onTryUpdateSelectedInstanceTransform: (mesh, instanceId, x, z, yaw) => {
                return this.worldMap3D.tryUpdateBuildingTransform(mesh, instanceId, x, z, yaw);
            },
            onTransformValidityChanged: (valid) => {
                this.lastTransformValid = valid;
            },
            onSelectObject: (obj) => {
                if (obj === this.transformProxy) {
                    this.roadGizmo.clearSelection();
                    this.selectedObject.set(undefined);
                    // Re-sync proxy pose with active selected instance.
                    this.currentGizmo = this.objectGizmo;
                    this.objectGizmo.syncSelectionFromSelectedObject();
                    return;
                }

                const roadSegment = this.#getRoadSegmentFromObject(obj);
                if (roadSegment) {
                    this.selectRoadSegment(roadSegment);
                    this.onCustomGizmoObjectSelected?.(obj);
                    return;
                }

                this.selectedObject.set({ object3D: obj } as any);
                if (obj.userData?.selectableType === 'road') {
                    this.objectGizmo.clearSelection();
                }
                this.#updateSelectionHalo();
                this.onCustomGizmoObjectSelected?.(obj);
            },
            onDraggingChanged: (dragging) => {
                if (context.cameraControls) context.cameraControls.enabled = !dragging;
            },
        });

        this.roadGizmo = new RoadGizmo({
            scene: this.scene,
            camera: this.camera,
            raycaster: this.raycaster,
            domElement: context.renderer.domElement,
            onDraggingChanged: (dragging) => {
                if (context.cameraControls) context.cameraControls.enabled = !dragging;
            },
        });

        this.roadGizmo.getSelectedRoadHandle = () => {
            const roadSegment = this.#getSelectedRoadSegment();
            if (!roadSegment) return undefined;

            return {
                startX: roadSegment.startX,
                startZ: roadSegment.startZ,
                endX: roadSegment.endX,
                endZ: roadSegment.endZ,
                angle: roadSegment.angle,
                length: roadSegment.length,
                midX: roadSegment.arcMidX,
                midZ: roadSegment.arcMidZ,
            };
        };
        this.roadGizmo.onRoadMoved = (x, z, angle, axis: RoadHandleAxis) => {
            let side: SegmentSide | undefined = (axis === 'start' ? 'start' : axis === 'end' ? 'end' : undefined);
            this.#getSelectedRoadSegment()?.moveTo({ x, z }, angle);
            this.roadNetwork.refreshTransientJoinArcs(this.#getSelectedRoadSegment(), side);
        };
        this.roadGizmo.onRoadResized = (newLength) => {
            const seg = this.#getSelectedRoadSegment();
            if (!seg) return;
            seg.resize(newLength);
            //this.roadNetwork.refreshTransientJoinArcs(this.#getSelectedRoadSegment());
            this.onRoadSegmentResized?.(seg);
        };
        this.roadGizmo.onArcChanged = (midX, midZ) => {
            this.#getSelectedRoadSegment()?.setArc({ x: midX, z: midZ });
            //this.roadNetwork.refreshTransientJoinArcs(this.#getSelectedRoadSegment());
        };
        this.roadGizmo.onDeselect = () => {
            this.selectedObject.set(undefined);
            this.currentGizmo = undefined;
            this.#updateSelectionHalo();
        };
        this.roadGizmo.onDragEnded = () => {
            (this.toolMap.get('road') as RoadToolController | undefined)?.onRoadDragEnded();
            this.roadNetwork.refreshTransientJoinArcs(this.#getSelectedRoadSegment());
        };
    }

    isSelectable: (obj: THREE.Object3D) => boolean = (obj) => {
        let owner = obj.userData?.owner;
        if (owner) {
            return true;
        }
        return false;
    }


    pickSelectableAtPointer(event: PointerEvent): THREE.Object3D | undefined {
        if (!this.renderDom) return undefined;

        const rect = this.renderDom.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        this.raycaster.setFromCamera(mouse, this.camera);

        const hits = this.raycaster.intersectObjects(this.scene.children, true);
        for (const hit of hits) {
            let target: THREE.Object3D | null = hit.object;
            while (target && !this.isSelectable(target)) {
                target = target.parent;
            }
            if (target) {
                return target;
            }
        }

        return undefined;
    }

}


