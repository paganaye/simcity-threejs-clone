import * as THREE from 'three';
import { AssetManager } from "./AssetManager"
import { SimObject3D } from "./SimObject3D";
import { Tiles3D } from './Tiles3D';
import type { UIProps } from './GamePage';
import { SimBridge } from '../sim/SimBridge';
import { Cars3D } from './Cars3D';
import { ICityChanged } from '../sim/Init';
import { Painter } from '../sim/Painter';
import GUI from 'lil-gui';
import { Page } from './Page';


export class Scene3D {
    assetManager: AssetManager = new AssetManager(this)
    tiles3D!: Tiles3D;
    cars3D!: Cars3D;
    //cameraManager!: CameraManager;
    //inputManager!: InputManager;
    sim = new SimBridge(this).createCaller();
    focusedObject: SimObject3D | null = null;
    renderer!: THREE.WebGLRenderer;
    scene!: THREE.Scene;
    raycaster!: THREE.Raycaster;
    grid?: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>;
    overlay?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>;
    painter!: Painter;
    gui?: GUI;
    camera!: THREE.PerspectiveCamera;
    container!: HTMLElement;

    constructor(readonly uiProps: UIProps) { }

    async init(context: Page) {
        this.scene = context.scene;
        this.renderer = context.renderer;
        this.gui = context.gui!;
        this.camera = context.camera;
        this.container = context.appContainer;

        let uiProps = this.uiProps;

        let pendingAssetManager = this.assetManager.init()
        this.tiles3D = new Tiles3D(this);
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

        this.tiles3D.init();


        await pendingAssetManager;
        uiProps.setIsLoading(false);

        let changes = await this.sim.init();
        if (changes.cityChanged) {
            this.onCityChanged(changes.cityChanged);
        }
        if (changes.tileChanged) {
            this.tiles3D.onTileChanged(changes.tileChanged);
        }
        if (changes.carChanged) {
            this.cars3D.onCarsChanged(changes.carChanged);
        }

    }

    onTilesResized() {
        this.#setupGrid();
    }

    onCityChanged(cityChanged: ICityChanged) {
        this.uiProps.setCityName(cityChanged.name);
        this.tiles3D.setSize(cityChanged.width, cityChanged.height);
        if (cityChanged.clear) this.tiles3D.clearCity();
    }

    #setupGrid() {
        if (this.grid) this.scene.remove(this.grid)
        let { width, height } = this.tiles3D
        // Add the grid
        const gridMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            map: this.assetManager.textures['grid'],
            transparent: true,
            opacity: 0.2
        });
        gridMaterial.map!.repeat = new THREE.Vector2(width, height);
        gridMaterial.map!.wrapS = THREE.RepeatWrapping; // city.size; 
        gridMaterial.map!.wrapT = THREE.RepeatWrapping; // city.size;

        const grid = new THREE.Mesh(
            new THREE.BoxGeometry(width, 0.1, height),
            gridMaterial
        );
        grid.position.set(width / 2 - 0.5, -0.04, height / 2 - 0.5);
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

        //if (this.inputManager.isLeftMouseDown) {
        //this.useTool();
        //}
        this.cars3D.drawFrame(now)
        this.tiles3D.drawFrame(now)
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
        // var coords = new THREE.Vector2(
        //     (this.inputManager.x / this.renderer.domElement.clientWidth) * 2 - 1,
        //     -(this.inputManager.y / this.renderer.domElement.clientHeight) * 2 + 1
        // );

        //this.raycaster.setFromCamera(coords, this.camera);

        let intersections = this.raycaster.intersectObjects(this.tiles3D.root.children, true);
        if (intersections.length > 0) {
            // The SimObject attached to the mesh is stored in the user data
            const selectedObject = intersections[0].object.userData as SimObject3D | null;
            return selectedObject;
        } else {
            return null;
        }
    }


}
