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
import { random } from '../sim/Rng';



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
    overlay?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>;

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

    onTilesResized() {
        this.#setupGrid();
        this.#setupOverlay();
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
        let { width, height } = this.city3D
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

    #setupOverlay() {
        let { width, height } = this.city3D;
        if (this.overlay) this.scene.remove(this.overlay);
        if (width || height) {
            const PixelPerTile = 8;
            let pw = width * PixelPerTile;
            let ph = height * PixelPerTile;

            const data = new Uint8Array(pw * ph * 4); // RGBA
            for (let i = 0; i < data.length; i += 4) {
                data[i] = random(255);       // R
                data[i + 1] = random(255);   // G
                data[i + 2] = random(255);   // B
                data[i + 3] = random(255);   // A

            }

            const texture = new THREE.DataTexture(data, pw, ph, THREE.RGBAFormat);
            //texture.magFilter = THREE.NearestFilter;
            //texture.minFilter = THREE.NearestFilter;
            texture.needsUpdate = true;

            const material = new THREE.MeshBasicMaterial({ map: texture });
            const geometry = new THREE.PlaneGeometry(width, height);
            const overlay = new THREE.Mesh(geometry, material);
            this.overlay = overlay;

            overlay.position.set(width / 2 - 0.5, 0, height / 2 - 0.5);
            overlay.rotation.x = -Math.PI / 2; // à plat au sol
            this.scene.add(overlay);
        }
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
