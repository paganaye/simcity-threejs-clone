import * as THREE from 'three';
import { AssetManager } from "./AssetManager"
import { WorldMap3D } from './WorldMap3D';
import type { UIProps } from './GamePage';
import { SimBridge } from '../sim/SimBridge';
import { Cars3D } from './Cars3D';
import { ICityChanged } from '../sim/Init';
import { Painter } from '../sim/Painter';
import GUI from 'lil-gui';
import { Page } from './Page';
import { CustomGizmo, type ISelectedInstance } from './editor/CustomGizmo';

export class Scene3D {
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
    customGizmo?: CustomGizmo;
    readonly transformProxy = new THREE.Object3D();
    selectionHalo?: THREE.Group;
    readonly selectionHaloLayers: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>[] = [];
    lastTransformValid = true;
    readonly tempWorldMatrix = new THREE.Matrix4();
    readonly tempBox = new THREE.Box3();
    readonly tempSize = new THREE.Vector3();
    readonly tempCenter = new THREE.Vector3();
    readonly tempCenterWorld = new THREE.Vector3();

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
        uiProps.isLoading.set(false);

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
        this.uiProps.cityName.set(cityChanged.name);
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
        //if (this.inputManager.isLeftMouseDown) {
        //this.useTool();
        //}
        this.cars3D.drawFrame(now)
        this.worldMap3D.drawFrame(now)
        this.customGizmo?.update();
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

            let selected: ISelectedInstance | undefined;
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
            this.uiProps.selectedInstance.set(selected);
            this.lastTransformValid = true;
            this.customGizmo?.syncSelectionFromSelectedInstance();
            this.#updateSelectionHalo();
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
