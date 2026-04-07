import * as THREE from 'three';
import { AssetManager } from "./AssetManager"
import { WorldMap3D } from './WorldMap3D';
import { SimBridge } from '../sim/SimBridge';
import { Cars3D } from './Cars3D';
import { ICityChanged } from '../sim/Init';
import { Painter } from '../sim/Painter';
import GUI from 'lil-gui';
import { Page } from './Page';
import { IFloorSize, UIProps } from './GameUIComponent';
import { RoadGizmo } from './editor/RoadGizmo';
import type { CustomGizmo } from './editor/CustomGizmo';
import { ISelectedInstance, ObjectGizmo } from './editor/ObjectGizmo';
import { RoadSegment } from './RoadSegment';

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
    selectedInstance?: ISelectedInstance;
    readonly tempMatrix = new THREE.Matrix4();
    readonly tempPosition = new THREE.Vector3();
    readonly tempQuaternion = new THREE.Quaternion();
    readonly tempScale = new THREE.Vector3();
    pageContext?: Page;
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
    onLeftPointerDown?: (event: PointerEvent, gesture: ILeftPointerGesture) => void;
    onLeftPointerMove?: (event: PointerEvent, gesture: ILeftPointerGesture) => void;
    onLeftPointerUp?: (event: PointerEvent, gesture: ILeftPointerGesture) => void;
    onLeftPointerCancel?: () => void;
    /** Called by the road gizmo after each resize (drag of end handle). */
    onRoadSegmentResized?: (segment: RoadSegment) => void;
    /** Called by the road gizmo when a drag ends (pointer up). */
    onRoadDragEnded?: () => void;
    size: IFloorSize;

    constructor(readonly uiProps: UIProps) {
        this.size = uiProps.mapSize;
    }

    async init(context: Page) {
        this.pageContext = context;
        this.scene = context.scene;
        this.renderer = context.renderer;
        this.gui = context.gui!;
        this.camera = context.camera;
        this.container = context.appContainer;
        this.renderDom = context.renderer.domElement;

        let uiProps = this.uiProps;
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
        this.#setupGround();
        await pendingAssetManager;
        uiProps.isLoading.set(false);

        let changes = await this.sim.init();
        if (changes.cityChanged) {
            this.onCityChanged(changes.cityChanged);
        }
        if (changes.carChanged) {
            this.cars3D.onCarsChanged(changes.carChanged);
        }

    }

    onCityChanged(cityChanged: ICityChanged) {
        this.uiProps.cityName.set(cityChanged.name);
        if (cityChanged.clear) this.worldMap3D.clearCity();
        //this.worldMap3D.setSize(cityChanged.width, cityChanged.height);

        const centerX = cityChanged.width / 2 - 0.5;
        const centerZ = cityChanged.height / 2 - 0.5;
        this.camera.lookAt(centerX, 0, centerZ);
        if (this.pageContext?.controls) {
            this.pageContext.controls.target.set(centerX, 0, centerZ);
            this.pageContext.controls.update();
        }

    }

    #getSelectedRoadSegment(): RoadSegment | undefined {
        return this.uiProps.selectedCustomObject.get()?.userData?.roadSegment as RoadSegment | undefined;
    }

    clearSelection(): void {
        this.selectedInstance = undefined;
        this.uiProps.selectedInstance.set(undefined);
        this.uiProps.selectedCustomObject.set(undefined);
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

        this.selectedInstance = undefined;
        this.uiProps.selectedInstance.set(undefined);
        this.uiProps.selectedCustomObject.set(segment.group);
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

    #selectInstance(selected: ISelectedInstance | undefined): void {
        this.selectedInstance = selected;
        this.uiProps.selectedInstance.set(selected);
        this.uiProps.selectedCustomObject.set(undefined);
        this.roadGizmo.clearSelection();

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
        //if (this.inputManager.isLeftMouseDown) {
        //this.useTool();
        //}
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

        const selected = this.selectedInstance;
        if (!selected) {
            this.selectionHalo.visible = false;
            return;
        }

        const geometry = selected.mesh.geometry;
        if (!geometry.boundingBox) {
            geometry.computeBoundingBox();
        }

        if (!geometry.boundingBox) {
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

            const controls = this.pageContext?.controls;
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
                this.onLeftPointerDown?.(event, {
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
            const controls = this.pageContext?.controls;
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
                    this.onLeftPointerMove?.(event, {
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
            const controls = this.pageContext?.controls;
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

                const shouldHandleAsClick = this.isLeftPointerDown
                    && !this.leftPointerDownMoved
                    && !this.leftPointerDownConsumedByGizmo;

                if (shouldHandleAsClick) {
                    if (!this.renderDom) return;
                    const rect = this.renderDom.getBoundingClientRect();
                    const mouse = new THREE.Vector2(
                        ((event.clientX - rect.left) / rect.width) * 2 - 1,
                        -((event.clientY - rect.top) / rect.height) * 2 + 1
                    );

                    this.raycaster.setFromCamera(mouse, this.camera);
                    const hits = this.raycaster.intersectObjects(this.scene.children, true);

                    let selected: ISelectedInstance | undefined;
                    let selectedObject3D: THREE.Object3D | undefined;
                    for (const hit of hits) {
                        // Skip the proxy itself
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

                        selected = {
                            mesh: obj,
                            instanceId: hit.instanceId,
                            selectableType,
                        };
                        if (this.uiProps.selectionFilter && !this.uiProps.selectionFilter(selected)) {
                            selected = undefined;
                        } else break;
                    }

                    if (selectedObject3D?.userData?.roadSegment) {
                        this.selectRoadSegment(selectedObject3D.userData.roadSegment as RoadSegment);
                    } else {
                        this.#selectInstance(selected);
                    }
                }

                this.onLeftPointerUp?.(event, gesture);
                this.isLeftPointerDown = false;
                this.leftPointerDownMoved = false;
                this.leftPointerDownConsumedByGizmo = false;
            }

            controls?.handlePointerUp();
        });

        this.renderDom?.addEventListener('pointercancel', () => {
            const controls = this.pageContext?.controls;
            this.currentGizmo?.onPointerUp();
            this.onLeftPointerCancel?.();
            this.isLeftPointerDown = false;
            this.leftPointerDownMoved = false;
            this.leftPointerDownConsumedByGizmo = false;
            controls?.handlePointerUp();
        });

        this.renderDom?.addEventListener('pointerleave', () => {
            this.pageContext?.controls?.handlePointerUp();
        });

        this.renderDom?.addEventListener('wheel', (event) => {
            this.pageContext?.controls?.handleWheel(event);
        }, { passive: false });

        this.renderDom?.addEventListener('contextmenu', (event) => {
            this.pageContext?.controls?.handleContextMenu(event);
        });

        window.addEventListener('pointerup', () => {
            this.pageContext?.controls?.handleWindowPointerUp();
        });
    }

    #setupCustomGizmo(context: Page) {
        this.scene.add(this.transformProxy);
        this.objectGizmo = new ObjectGizmo({
            scene: this.scene,
            camera: this.camera,
            raycaster: this.raycaster,
            domElement: context.renderer.domElement,
            getSelectedInstance: () => this.selectedInstance,
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
                    this.uiProps.selectedCustomObject.set(undefined);
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

                this.selectedInstance = undefined;
                this.uiProps.selectedInstance.set(undefined);
                this.uiProps.selectedCustomObject.set(obj);
                if (obj.userData?.selectableType === 'road') {
                    this.objectGizmo.clearSelection();
                }
                this.#updateSelectionHalo();
                this.onCustomGizmoObjectSelected?.(obj);
            },
            onDraggingChanged: (dragging) => {
                if (context.controls) context.controls.enabled = !dragging;
            },
        });

        this.roadGizmo = new RoadGizmo({
            scene: this.scene,
            camera: this.camera,
            raycaster: this.raycaster,
            domElement: context.renderer.domElement,
            onDraggingChanged: (dragging) => {
                if (context.controls) context.controls.enabled = !dragging;
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
            this.selectedInstance = undefined;
            this.uiProps.selectedInstance.set(undefined);
            this.uiProps.selectedCustomObject.set(undefined);
            this.currentGizmo = undefined;
            this.#updateSelectionHalo();
        };
        this.roadGizmo.onDragEnded = () => {
            this.onRoadDragEnded?.();
        };
    }

}


