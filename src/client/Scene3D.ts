import * as THREE from 'three';
import { AssetManager } from "./AssetManager"
import { SimObject3D } from "./SimObject3D";
import { WorldMap3D } from './WorldMap3D';
import type { UIProps } from './GamePage';
import { SimBridge } from '../sim/SimBridge';
import { Cars3D } from './Cars3D';
import { ICityChanged } from '../sim/Init';
import { Painter } from '../sim/Painter';
import GUI from 'lil-gui';
import { Page } from './Page';
import { CustomGizmo, type GizmoSelectedInstance } from './editor/CustomGizmo';

export class Scene3D {
    assetManager: AssetManager = new AssetManager(this)
    worldMap3D!: WorldMap3D;
    cars3D!: Cars3D;
    //cameraManager!: CameraManager;
    //inputManager!: InputManager;
    sim = new SimBridge(this).createCaller();
    focusedObject: SimObject3D | null = null;
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
    selectionHalo?: THREE.Mesh;
    selectedInstance?: GizmoSelectedInstance;
    readonly tempMatrix = new THREE.Matrix4();
    readonly tempPosition = new THREE.Vector3();
    readonly tempQuaternion = new THREE.Quaternion();
    readonly tempScale = new THREE.Vector3();
    pageContext?: Page;
    customGizmo?: CustomGizmo;
    readonly transformProxy = new THREE.Object3D();
    lastTransformValid = true;

    constructor(readonly uiProps: UIProps) { }

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
        //this.cameraManager = new CameraManager(uiProps.gameWindow);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        //this.scene = new THREE.Scene();


        //this.inputManager = new InputManager(uiProps.gameWindow);

        // this.renderer.setSize(uiProps.gameWindow.clientWidth, uiProps.gameWindow.clientHeight);
        // this.renderer.setClearColor(0x000000, 0);
        // this.renderer.shadowMap.enabled = true;
        // this.renderer.shadowMap.type = THREE.PCFShadowMap;

        this.raycaster = new THREE.Raycaster();


        //this.scene.clear();
        this.#setupLights();
        this.#setupSelectionHalo();
        this.#setupSelectionInput();
        this.#setupCustomGizmo(context);

        this.worldMap3D.init();


        await pendingAssetManager;
        uiProps.setIsLoading(false);

        let changes = await this.sim.init();
        if (changes.cityChanged) {
            this.onCityChanged(changes.cityChanged);
        }
        if (changes.carChanged) {
            this.cars3D.onCarsChanged(changes.carChanged);
        }

    }

    onMapResized() {
        this.#setupGround();
    }

    onCityChanged(cityChanged: ICityChanged) {
        this.uiProps.setCityName(cityChanged.name);
        if (cityChanged.clear) this.worldMap3D.clearCity();
        this.worldMap3D.setSize(cityChanged.width, cityChanged.height);

        const centerX = cityChanged.width / 2 - 0.5;
        const centerZ = cityChanged.height / 2 - 0.5;
        this.camera.lookAt(centerX, 0, centerZ);
        if (this.pageContext?.controls) {
            this.pageContext.controls.target.set(centerX, 0, centerZ);
            this.pageContext.controls.update();
        }

    }

    #setupGround() {
        if (this.grid) this.scene.remove(this.grid)
        let { width, height } = this.worldMap3D
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x4f9d3a,
            roughness: 0.95,
            metalness: 0.0
        });

        const grid = new THREE.Mesh(
            new THREE.PlaneGeometry(width, height),
            groundMaterial
        );
        grid.rotation.x = -Math.PI / 2;
        grid.position.set(width / 2 - 0.5, -0.05, height / 2 - 0.5);
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
        this.updateFocusedObject();
        this.#updateSelectionHalo();

        //if (this.inputManager.isLeftMouseDown) {
        //this.useTool();
        //}
        this.cars3D.drawFrame(now)
        this.worldMap3D.drawFrame(now)
    }

    updateSelectedObject() {
        let selected = this.uiProps.selectedObject();
        if (this.focusedObject != selected) {
            selected?.setSelected(false);
            this.uiProps.setSelectedObject(this.focusedObject);
            this.focusedObject?.setSelected(true);
        }
    }

    updateFocusedObject() {
        const newObject = this.#raycast();
        if (newObject !== this.focusedObject) {
            //     this.focusedObject?.setFocused(false);
            //     this.focusedObject = newObject;
            //     this.focusedObject?.setFocused(true);
        }
    }


    #raycast(): SimObject3D | null {
        let intersections = this.raycaster.intersectObjects(this.worldMap3D.root.children, true);
        if (intersections.length > 0) {
            // The SimObject attached to the mesh is stored in the user data
            const selectedObject = intersections[0].object.userData as SimObject3D | null;
            return selectedObject;
        } else {
            return null;
        }
    }

    #setupSelectionHalo() {
        const halo = new THREE.Mesh(
            new THREE.RingGeometry(0.8, 1.0, 48),
            new THREE.MeshBasicMaterial({
                color: 0xffe066,
                transparent: true,
                opacity: 0.95,
                side: THREE.DoubleSide,
                depthWrite: false,
            })
        );
        halo.rotation.x = -Math.PI / 2;
        halo.visible = false;
        this.selectionHalo = halo;
        this.scene.add(halo);
    }

    #setupSelectionInput() {
        this.renderDom?.addEventListener('pointerdown', (event) => {
            if (!this.renderDom) return;
            const rect = this.renderDom.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
            if (!mouse) return;

            if (this.customGizmo?.onPointerDown(event)) {
                event.stopPropagation();
                event.preventDefault();
                return;
            }

            this.raycaster.setFromCamera(mouse, this.camera);
            const hits = this.raycaster.intersectObjects(this.scene.children, true);

            let selected: GizmoSelectedInstance | undefined;
            for (const hit of hits) {
                // Skip the proxy itself
                if (hit.object === this.transformProxy) continue;

                const obj = hit.object as THREE.InstancedMesh;
                const selectableType = obj.userData?.selectableType as ('building' | 'character' | undefined);
                if (!selectableType) continue;
                if (hit.instanceId == null) continue;

                selected = {
                    mesh: obj,
                    instanceId: hit.instanceId,
                    selectableType,
                };

                break;
            }

            // If nothing selected, deselect current
            this.selectedInstance = selected;
            this.lastTransformValid = true;
            this.customGizmo?.syncSelectionFromSelectedInstance();
        });

        this.renderDom?.addEventListener('pointermove', (event) => {
            if (this.customGizmo?.onPointerMove(event)) {
                //this.#onTransformChanged();
            }
        });

        this.renderDom?.addEventListener('pointerup', () => {
            this.customGizmo?.onPointerUp();
        });

        this.renderDom?.addEventListener('pointercancel', () => {
            this.customGizmo?.onPointerUp();
        });
    }

    #updateSelectionHalo() {
        if (!this.selectionHalo) return;
        if (!this.selectedInstance) {
            this.selectionHalo.visible = false;
            return;
        }

        const { mesh, instanceId, selectableType } = this.selectedInstance;
        if (selectableType === 'building') {
            // Buildings already have a custom transform ring; avoid duplicate circles.
            this.selectionHalo.visible = false;
            return;
        }
        mesh.getMatrixAt(instanceId, this.tempMatrix);
        this.tempMatrix.decompose(this.tempPosition, this.tempQuaternion, this.tempScale);

        let radius = 1.0;
        radius = Math.max(0.5, this.tempScale.x * 0.8);

        this.selectionHalo.position.set(this.tempPosition.x, 0.08, this.tempPosition.z);
        this.selectionHalo.scale.set(radius, radius, 1);
        const haloMat = this.selectionHalo.material as THREE.MeshBasicMaterial;
        haloMat.color.setHex(this.lastTransformValid ? 0xffe066 : 0xff2d2d);
        this.selectionHalo.visible = true;
    }

    #setupCustomGizmo(context: Page) {
        this.scene.add(this.transformProxy);
        this.customGizmo = new CustomGizmo({
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
                // Only the proxy is directly selectable by the gizmo
                return obj === this.transformProxy;
            },
            onSelectObject: () => {
                // Re-sync proxy pose with active selected instance.
                this.customGizmo?.syncSelectionFromSelectedInstance();
            },
            onDraggingChanged: (dragging) => {
                if (context.controls) context.controls.enabled = !dragging;
            },
        });
    }
    
}
