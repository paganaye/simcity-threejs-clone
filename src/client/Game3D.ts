import * as THREE from 'three';
import { AssetManager } from "./AssetManager"
import { SimObject3D } from "./SimObject3D";
import { City3D } from './City3D';
import { CameraManager } from './CameraManager';
import type { UIProps } from './GameUI';
import { InputManager } from './InputManager';
import { SimBridge } from '../sim/SimBridge';
import { Cars3D } from './Cars3D';
import { ICityChanged } from '../sim/Init';



export class Game3D {
    assetManager: AssetManager = new AssetManager(this)
    city3D!: City3D;
    cars3D!: Cars3D;
    cameraManager!: CameraManager;
    inputManager!: InputManager;
    sim = new SimBridge(this).createCaller();
    focusedObject: SimObject3D | null = null;
    renderer!: THREE.WebGLRenderer;
    scene!: THREE.Scene;
    raycaster!: THREE.Raycaster;
    grid?: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>;

    constructor(readonly uiProps: UIProps) { }

    async init() {
        let uiProps = this.uiProps;

        let pendingAssetManager = this.assetManager.init()
        this.city3D = new City3D(this);
        this.cars3D = new Cars3D(this)
        this.cameraManager = new CameraManager(uiProps.gameWindow);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        this.scene = new THREE.Scene();

        this.inputManager = new InputManager(uiProps.gameWindow);

        this.renderer.setSize(uiProps.gameWindow.clientWidth, uiProps.gameWindow.clientHeight);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;

        this.raycaster = new THREE.Raycaster();


        this.scene.clear();
        this.#setupLights();
        this.#setupGrid();

        this.city3D.init();

        uiProps.gameWindow.appendChild(this.renderer.domElement);

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                this.onResize(width, height);
            }
        });
        resizeObserver.observe(uiProps.gameWindow);
        this.start();
        await pendingAssetManager;
        uiProps.setIsLoading(false);

        let changes = await this.sim.init();
        if (changes.cityChanged) {
            this.onCityChanged(changes.cityChanged);
        }
        if (changes.tileChanged) {
            this.city3D.onTileChanged(changes.tileChanged);
        }
        if (changes.carChanged) {
            this.cars3D.onCarsChanged(changes.carChanged);
        }
    }

    start() {
        this.renderer.setAnimationLoop((d) => this.drawFrame(d));
    }

    stop() {
        this.renderer.setAnimationLoop(null);
    }

    onCityChanged(cityChanged: ICityChanged) {
        this.uiProps.setCityName(cityChanged.name);
        this.city3D.setSize(cityChanged.width, cityChanged.height);
        if (cityChanged.clear) this.city3D.clearCity();
    }

    #setupGrid() {
        if (this.grid) this.scene.remove(this.grid)
        // Add the grid
        const gridMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            map: this.assetManager.textures['grid'],
            transparent: true,
            opacity: 0.2
        });
        gridMaterial.map!.repeat = new THREE.Vector2(this.city3D.width, this.city3D.height);
        gridMaterial.map!.wrapS = THREE.RepeatWrapping; // city.size; 
        gridMaterial.map!.wrapT = THREE.RepeatWrapping; // city.size;


        const grid = new THREE.Mesh(
            new THREE.BoxGeometry(this.city3D.width, 0.1, this.city3D.height),
            gridMaterial
        );
        grid.position.set(this.city3D.width / 2 - 0.5, -0.04, this.city3D.height / 2 - 0.5);
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

    drawFrame(delta: number) {
        if (delta > 100) delta = 100;
        //this.city.draw();
        this.updateFocusedObject();

        if (this.inputManager.isLeftMouseDown) {
            //this.useTool();
        }
        this.cars3D.drawFrame(delta)
        this.city3D.drawFrame(delta)
        this.renderer.render(this.scene, this.cameraManager.camera);
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
        var coords = new THREE.Vector2(
            (this.inputManager.x / this.renderer.domElement.clientWidth) * 2 - 1,
            -(this.inputManager.y / this.renderer.domElement.clientHeight) * 2 + 1
        );

        this.raycaster.setFromCamera(coords, this.cameraManager.camera);

        let intersections = this.raycaster.intersectObjects(this.city3D.root.children, true);
        if (intersections.length > 0) {
            // The SimObject attached to the mesh is stored in the user data
            const selectedObject = intersections[0].object.userData as SimObject3D | null;
            return selectedObject;
        } else {
            return null;
        }
    }

    /**
     * Resizes the renderer to fit the current game window
     */
    onResize(w: number, h: number) {
        this.cameraManager.resize(w, h);
        this.renderer.setSize(w, h);
    }
}
