import * as THREE from 'three';
import { AssetManager } from "./AssetManager"
import { WorldMap3D } from './WorldMap3D';
import { SimBridge } from '../sim/SimBridge';
import { Cars3D } from './Cars3D';
import { ICityChanged } from '../sim/Init';
import { Painter } from '../sim/Painter';
import GUI from 'lil-gui';
import { Page } from './Page';
import { IFloorSize } from './GameUIComponent';
import { RoadGizmo } from './editor/RoadGizmo';
import type { CustomGizmo } from './editor/CustomGizmo';
import { ISelectedInstance, ObjectGizmo } from './editor/ObjectGizmo';
import { RoadSegment } from './RoadSegment';
import { ToolController } from './tools/ToolController';
import { RoadToolController } from './tools/RoadToolController';
import { BulldozerToolController } from './tools/BulldozerToolController';
import { SelectToolController } from './tools/SelectToolController';
import { ActiveTool } from './tools/ToolTypes';
import { RoadNetwork } from './RoadNetwork';
import { Signal } from './Signal';

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
    leftPointerDownX = 0;
    leftPointerDownY = 0;
    /** Called by the road gizmo after each resize (drag of end handle). */
    onRoadSegmentResized?: (segment: RoadSegment) => void;
    readonly roadNetwork = new RoadNetwork();
    private currentToolController?: ToolController;
    private currentTool: ActiveTool = 'select';
    private readonly toolMap = new Map<ActiveTool, ToolController>();
    size: IFloorSize;
    isLoading = new Signal(true);
    isPaused = new Signal(false);
    activeTool = new Signal<ActiveTool>('select');
    selectedInstance = new Signal<ISelectedInstance | undefined>(undefined);
    selectedCustomObject = new Signal<THREE.Object3D | undefined>(undefined);
    simMoney = new Signal(0);
    population = new Signal(0);
    simTime = new Signal(0);
    cityName = new Signal('My City');

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
        this.currentTool = tool;
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
            this.currentTool !== 'bulldoze' && obj.userData?.selectableType === 'road';

        this.onRoadSegmentResized = (seg) => roadController.onRoadSegmentResized(seg);

        this.setActiveTool(this.activeTool.get());
    }

    #getSelectedRoadSegment(): RoadSegment | undefined {
        return this.selectedCustomObject.get()?.userData?.roadSegment as RoadSegment | undefined;
    }

    clearSelection(): void {
        this.selectedInstance.set(undefined);
        this.selectedCustomObject.set(undefined);
        this.currentGizmo = undefined;
        this.roadGizmo.clearSelection();
        this.objectGizmo.clearSelection();
        this.#updateSelectionHalo();
    }

    selectRoadSegment(segment: RoadSegment | undefined): void {
        if (!segment) {
            this.clearSelection()
            return;
        }

        this.selectedInstance.set(undefined);
        this.selectedCustomObject.set(segment.group);
        this.currentGizmo = this.roadGizmo;
        this.objectGizmo.clearSelection();
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

        let selected: ISelectedInstance | undefined;
        let selectedObject3D: THREE.Object3D | undefined;
        for (const hit of hits) {
            if (hit.object === this.transformProxy) continue;
            const selectableType = hit.object.userData?.selectableType as ('building' | 'character' | 'road' | undefined);
            if (!selectableType) continue;
            if (selectableType === 'road') {
                selectedObject3D = hit.object.userData?.roadSegment?.group as THREE.Object3D | undefined;
                if (selectedObject3D) break;
                continue;
            }
            if (hit.instanceId == null) continue;
            const obj = hit.object as THREE.InstancedMesh;
            selected = { mesh: obj, instanceId: hit.instanceId, selectableType };
            break;
        }

        if (selectedObject3D?.userData?.roadSegment) {
            this.selectRoadSegment(selectedObject3D.userData.roadSegment as RoadSegment);
        } else {
            this.#selectInstance(selected);
        }
    }

    #selectInstance(selected: ISelectedInstance | undefined): void {
        this.roadGizmo.clearSelection();
        this.selectedInstance.set(selected);
        this.selectedCustomObject.set(undefined);

        if (selected?.selectableType === 'building') {
            this.currentGizmo = this.objectGizmo;
            this.objectGizmo.syncSelectionFromSelectedInstance();
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

        const selected = this.selectedInstance.get();
        if (!selected) {
            this.selectionHalo.visible = false;
            return;
        }

        const geometry = selected.mesh.geometry;
        if (!geometry?.boundingBox) {
            geometry?.computeBoundingBox();
        }

        if (!geometry?.boundingBox) {
            this.selectionHalo.visible = false;
            return;
        }

        selected.mesh.getMatrixAt(selected.instanceId, this.tempMatrix);
        this.tempWorldMatrix.multiplyMatrices(selected.mesh.matrixWorld, this.tempMatrix);
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
        this.renderDom?.addEventListener('pointerdown', (event) => {
            if (!this.renderDom) return;

            const controls = this.page?.cameraControls;
            if (event.button !== 0) {
                controls?.handlePointerDown(event);
                return;
            }

            this.isLeftPointerDown = true;
            this.leftPointerDownMoved = false;
            this.leftPointerDownConsumedByGizmo = false;
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
            controls?.handlePointerUp();
        });

        this.renderDom?.addEventListener('pointerleave', () => {
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

    #setupCustomGizmo(context: Page) {
        this.scene.add(this.transformProxy);
        this.objectGizmo = new ObjectGizmo({
            scene: this.scene,
            camera: this.camera,
            raycaster: this.raycaster,
            domElement: context.renderer.domElement,
            getSelectedInstance: () => this.selectedInstance.get(),
            getInstanceYaw: (mesh, instanceId) => this.worldMap3D.getBuildingYaw(mesh, instanceId),
            onTryUpdateSelectedInstanceTransform: (mesh, instanceId, x, z, yaw) => {
                return this.worldMap3D.tryUpdateBuildingTransform(mesh, instanceId, x, z, yaw);
            },
            onTransformValidityChanged: (valid) => {
                this.lastTransformValid = valid;
            },
            isSelectable: (obj) => {
                // Proxy is selectable by default, plus optional custom objects.
                return obj === this.transformProxy || this.isCustomGizmoSelectableObject?.(obj) === true;
            },
            onSelectObject: (obj) => {
                if (obj === this.transformProxy) {
                    this.roadGizmo.clearSelection();
                    this.selectedCustomObject.set(undefined);
                    // Re-sync proxy pose with active selected instance.
                    this.currentGizmo = this.objectGizmo;
                    this.objectGizmo.syncSelectionFromSelectedInstance();
                    return;
                }

                const roadSegment = obj.userData?.roadSegment as RoadSegment | undefined;
                if (roadSegment) {
                    this.selectRoadSegment(roadSegment);
                    this.onCustomGizmoObjectSelected?.(obj);
                    return;
                }

                this.selectedInstance.set(undefined);
                this.selectedCustomObject.set(obj);
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
        this.roadGizmo.onRoadMoved = (x, z, angle) => {
            this.#getSelectedRoadSegment()?.moveTo(x, z, angle);
        };
        this.roadGizmo.onRoadResized = (newLength) => {
            const seg = this.#getSelectedRoadSegment();
            if (!seg) return;
            seg.resize(newLength);
            this.onRoadSegmentResized?.(seg);
        };
        this.roadGizmo.onArcChanged = (midX, midZ) => {
            this.#getSelectedRoadSegment()?.setArc(midX, midZ);
        };
        this.roadGizmo.onDeselect = () => {
            this.selectedInstance.set(undefined);
            this.selectedCustomObject.set(undefined);
            this.currentGizmo = undefined;
            this.#updateSelectionHalo();
        };
        this.roadGizmo.onDragEnded = () => {
            (this.toolMap.get('road') as RoadToolController | undefined)?.onRoadDragEnded();
        };
    }

}


