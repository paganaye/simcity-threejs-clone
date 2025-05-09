import * as THREE from 'three';
import { AssetManager } from "./AssetManager"
import { SimObject3D } from "./SimObject3D";
import { City3D } from './City3D';
import { CameraManager } from './CameraManager';
import type { UIProps } from './GameUI';
import { InputManager } from './InputManager';
import { ICityChanged } from '../sim/Init';
import { ITileChange } from '../sim/Init';
import { SimBridge } from '../sim/SimBridge';



export class Game3D {
    assetManager: AssetManager = new AssetManager(this)
    cityView!: City3D;
    cameraManager!: CameraManager;
    inputManager!: InputManager;
    sim = new SimBridge(this).createCaller();

    /** 
     * Manager for the Three.js scene. Handles rendering of a `City` object
     */

    /**
     * Object that currently hs focus
     */
    focusedObject: SimObject3D | null = null;
    /**
     * Class for managing user input
     */
    //    inputManager!: InputManager;
    /**
     * Object that is currently selected
     */
    renderer!: THREE.WebGLRenderer;
    scene!: THREE.Scene;
    //  cameraManager!: CameraManager;
    raycaster!: THREE.Raycaster;
    grid?: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>;
    //    storage = new GameStorage(this);

    // cityName!: Accessor<string>;
    // setCityName!: Setter<string>;

    // populationCounter!: Accessor<number>;
    // setPopulationCounter!: Setter<number>;

    // simDate!: Accessor<string>;
    // setSimDate!: Setter<string>;

    // simMoney!: Accessor<number>;
    // setSimMoney!: Setter<number>;



    /**
     * Initalizes the scene, clearing all existing assets
     */


    constructor(readonly uiProps: UIProps) {
    }

    async init() {
        let uiProps = this.uiProps;

        let pendingAssetManager = this.assetManager.init()
        this.cityView = new City3D(this);
        this.cameraManager = new CameraManager(uiProps.gameWindow);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        this.scene = new THREE.Scene();

        this.inputManager = new InputManager(uiProps.gameWindow);

        // Configure the renderer
        this.renderer.setSize(uiProps.gameWindow.clientWidth, uiProps.gameWindow.clientHeight);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;

        // Add the renderer to the DOM
        //        ui.gameWindow.appendChild(this.renderer.domElement);

        // Variables for object selection
        this.raycaster = new THREE.Raycaster();

        /**
         * Global instance of the asset manager
         */
        // assetManager = new AssetManager(() => {
        //ui.setIsLoading(false);

        this.scene.clear();
        this.#setupLights();
        this.#setupGrid();

        this.cityView.init();
        this.scene.add(this.cityView);

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
            this.onTileChanged(changes.tileChanged);
        }
    }

    start() {
        this.renderer.setAnimationLoop(() => this.draw());
    }

    stop() {
        this.renderer.setAnimationLoop(null);
    }

    onCityChanged(cityChanged: ICityChanged) {
        this.uiProps.setCityName(cityChanged.name);
        this.cityView.setSize(cityChanged.width, cityChanged.height);
        if (cityChanged.clear) this.cityView.clearCity();
    }

    onTileChanged(tileChanged: ITileChange[]) {
        this.cityView.onTileChanged(tileChanged);
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
        gridMaterial.map!.repeat = new THREE.Vector2(this.cityView.width, this.cityView.height);
        gridMaterial.map!.wrapS = THREE.RepeatWrapping; // city.size; 
        gridMaterial.map!.wrapT = THREE.RepeatWrapping; // city.size;


        const grid = new THREE.Mesh(
            new THREE.BoxGeometry(this.cityView.width, 0.1, this.cityView.height),
            gridMaterial
        );
        grid.position.set(this.cityView.width / 2 - 0.5, -0.04, this.cityView.height / 2 - 0.5);
        this.grid = grid;
        this.scene.add(grid);
    }

    /**
     * Setup the lights for the scene
     */
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



    /**
     * Render the contents of the scene
     */
    draw() {
        //this.city.draw();
        this.updateFocusedObject();

        if (this.inputManager.isLeftMouseDown) {
            //this.useTool();
        }
        this.renderer.render(this.scene, this.cameraManager.camera);
    }

    /**
     * Moves the simulation forward by one step
     */
    // simulate() {
    // if (ui.isPaused()) return;

    // // Update the city data model first, then update the scene
    // city.simulate(1);

    // this.setCityName(city.name);
    // this.setPopulationCounter(city.population);

    // const date = new Date('1/1/2023');
    // date.setDate(date.getDate() + city.simTime);
    // this.setSimDate(date.toLocaleDateString());
    // this.setSimMoney(city.simMoney);

    // //ui.updateInfoPanel(this.selectedObject);
    // this.storage.saveGame();
    //}

    /**
     * Uses the currently active tool
     */
    // useTool() {
    //     switch (this.uiProps.activeTool()) {
    //         case 'select':
    //             this.updateSelectedObject();
    //             //         //ui.updateInfoPanel(this.selectedObject);
    //             break;
    //         case 'bulldoze':
    //             if (this.focusedObject) {
    //                 const { x, z } = this.focusedObject.position;
    //                 this.cityView.getTile(x, z)?.setBuilding(this, null);
    //                 this.saveGame();
    //             }
    //             break;
    //         default:
    //             if (this.focusedObject) {
    //                 const { x, z } = this.focusedObject.position;
    //                 this.cityView.getTile(x, z)?.setBuilding(this, 'residential-C2');
    //             }
    //             break;

    //     }
    // }

    saveGame() {
        //this.storage.saveGame();
    }

    /**
     * Sets the currently selected object and highlights it
     */

    updateSelectedObject() {
        let selected = this.uiProps.selectedObject();
        if (this.focusedObject != selected) {
            selected?.setSelected(false);
            this.uiProps.setSelectedObject(this.focusedObject);
            this.focusedObject?.setSelected(true);
        }
    }

    /**
     * Sets the object that is currently highlighted
     */
    updateFocusedObject() {
        //const newObject = this.#raycast();
        // if (newObject !== this.focusedObject) {
        //     this.focusedObject?.setFocused(false);
        //     this.focusedObject = newObject;
        //     this.focusedObject?.setFocused(true);
        // }
    }

    /**
     * Gets the mesh currently under the the mouse cursor. If there is nothing under
     * the the mouse cursor, returns null
     * @param {MouseEvent} event Mouse event
     */
    // #raycast(): SimObject | null {
    //     var coords = new THREE.Vector2(
    //         (this.inputManager.x / this.renderer.domElement.clientWidth) * 2 - 1,
    //         -(this.inputManager.y / this.renderer.domElement.clientHeight) * 2 + 1
    //     );

    //     this.raycaster.setFromCamera(coords, this.cameraManager.camera);

    //     let intersections = this.raycaster.intersectObjects(this.cityView.root.children, true);
    //     if (intersections.length > 0) {
    //         // The SimObject attached to the mesh is stored in the user data
    //         const selectedObject = intersections[0].object.userData as SimObject | null;
    //         return selectedObject;
    //     } else {
    //         return null;
    //     }
    // }

    /**
     * Resizes the renderer to fit the current game window
     */
    onResize(w: number, h: number) {
        this.cameraManager.resize(w, h);
        this.renderer.setSize(w, h);
    }
}
