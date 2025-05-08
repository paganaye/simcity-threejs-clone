import * as THREE from 'three';
import { CameraManager } from './camera';
import { InputManager } from './input';
import { SimObject } from './sim/simObject.js';
import { assetManager, city, ui } from '../App';
import { GameStorage } from './storage/GameStorage';
import { Accessor, createSignal, Setter } from 'solid-js';
/** 
 * Manager for the Three.js scene. Handles rendering of a `City` object
 */
export class Game {
  /**
   * Object that currently hs focus
   */
  focusedObject: SimObject | null = null;
  /**
   * Class for managing user input
   */
  inputManager!: InputManager;
  /**
   * Object that is currently selected
   */
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  cameraManager!: CameraManager;
  raycaster!: THREE.Raycaster;
  storage = new GameStorage(this);

  cityName!: Accessor<string>;
  setCityName!: Setter<string>;

  populationCounter!: Accessor<number>;
  setPopulationCounter!: Setter<number>;

  simDate!: Accessor<string>;
  setSimDate!: Setter<string>;

  simMoney!: Accessor<number>;
  setSimMoney!: Setter<number>;

  constructor() {
    [this.cityName, this.setCityName] = createSignal("");
    [this.populationCounter, this.setPopulationCounter] = createSignal(0);
    [this.simDate, this.setSimDate] = createSignal("...");
    [this.simMoney, this.setSimMoney] = createSignal(0);

  }

  init() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true
    });
    this.scene = new THREE.Scene();

    this.inputManager = new InputManager(ui.gameWindow);
    this.cameraManager = new CameraManager(ui.gameWindow);

    // Configure the renderer
    this.renderer.setSize(ui.gameWindow.clientWidth, ui.gameWindow.clientHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // Add the renderer to the DOM
    ui.gameWindow.appendChild(this.renderer.domElement);

    // Variables for object selection
    this.raycaster = new THREE.Raycaster();

    /**
     * Global instance of the asset manager
     */
    // assetManager = new AssetManager(() => {
    ui.setIsLoading(false);

    //   this.city = new City(16);
    this.initialize();
    this.start();

    setInterval(this.simulate.bind(this), 1000);

    window.addEventListener('resize', this.onResize.bind(this), false);
  }

  /**
   * Initalizes the scene, clearing all existing assets
   */
  initialize() {
    this.scene.clear();
    this.scene.add(city);
    this.#setupLights();
    this.#setupGrid();
  }

  #setupGrid() {
    // Add the grid
    const gridMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      map: assetManager.textures['grid'],
      transparent: true,
      opacity: 0.2
    });
    gridMaterial.map!.repeat = new THREE.Vector2(city.size, city.size);
    gridMaterial.map!.wrapS = THREE.RepeatWrapping; // city.size; 
    gridMaterial.map!.wrapT = THREE.RepeatWrapping; // city.size;


    const grid = new THREE.Mesh(
      new THREE.BoxGeometry(city.size, 0.1, city.size),
      gridMaterial
    );
    grid.position.set(city.size / 2 - 0.5, -0.04, city.size / 2 - 0.5);
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
   * Starts the renderer
   */
  start() {
    this.renderer.setAnimationLoop(this.draw.bind(this));
  }

  /**
   * Stops the renderer
   */
  stop() {
    this.renderer.setAnimationLoop(null);
  }

  /**
   * Render the contents of the scene
   */
  draw() {
    city.draw();
    this.updateFocusedObject();

    if (this.inputManager.isLeftMouseDown) {
      this.useTool();
    }

    this.renderer.render(this.scene, this.cameraManager.camera);
  }

  /**
   * Moves the simulation forward by one step
   */
  simulate() {
    if (ui.isPaused()) return;

    // Update the city data model first, then update the scene
    city.simulate(1);

    this.setCityName(city.name);
    this.setPopulationCounter(city.population);

    const date = new Date('1/1/2023');
    date.setDate(date.getDate() + city.simTime);
    this.setSimDate(date.toLocaleDateString());
    this.setSimMoney(city.simMoney);

    //ui.updateInfoPanel(this.selectedObject);
    this.storage.saveGame();
  }

  /**
   * Uses the currently active tool
   */
  useTool() {
    switch (ui.activeTool()) {
      case 'select':
        this.updateSelectedObject();
        //ui.updateInfoPanel(this.selectedObject);
        break;
      case 'bulldoze':
        if (this.focusedObject) {
          const { x, y } = this.focusedObject;
          city.bulldoze(x, y);
          this.saveGame();
        }
        break;
      default:
        if (this.focusedObject) {
          const { x, y } = this.focusedObject;
          if (city.placeBuilding(x, y, ui.activeTool())) {
            this.saveGame();
          }
        }
        break;
    }
  }


  saveGame() {
    this.storage.saveGame();
  }

  /**
   * Sets the currently selected object and highlights it
   */
  updateSelectedObject() {
    ui.selectedObject()?.setSelected(false);
    ui.setSelectedObject(this.focusedObject);
    ui.selectedObject()?.setSelected(true);
  }

  /**
   * Sets the object that is currently highlighted
   */
  updateFocusedObject() {
    const newObject = this.#raycast();
    if (newObject !== this.focusedObject) {
      this.focusedObject?.setFocused(false);
      this.focusedObject = newObject;
      this.focusedObject?.setFocused(true);
    }
  }

  /**
   * Gets the mesh currently under the the mouse cursor. If there is nothing under
   * the the mouse cursor, returns null
   * @param {MouseEvent} event Mouse event
   */
  #raycast(): SimObject | null {
    var coords = new THREE.Vector2(
      (this.inputManager.mouse.x / this.renderer.domElement.clientWidth) * 2 - 1,
      -(this.inputManager.mouse.y / this.renderer.domElement.clientHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(coords, this.cameraManager.camera);

    let intersections = this.raycaster.intersectObjects(city.root.children, true);
    if (intersections.length > 0) {
      // The SimObject attached to the mesh is stored in the user data
      const selectedObject = intersections[0].object.userData as SimObject | null;
      return selectedObject;
    } else {
      return null;
    }
  }

  /**
   * Resizes the renderer to fit the current game window
   */
  onResize() {
    this.cameraManager.resize();
    this.renderer.setSize(ui.gameWindow.clientWidth, ui.gameWindow.clientHeight);
  }
}


