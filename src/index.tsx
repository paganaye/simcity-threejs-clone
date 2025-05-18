import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
/* @refresh reload */
import { render } from 'solid-js/web';
import Stats from 'stats.js';
import { GUI } from 'lil-gui';

const DEFAULT_SCENE_KEY: SceneKey = "gameUI";
const LOCAL_STORAGE_SCENE_KEY = 'game_scene';

const scenes = {
    marblesTest: "./client/tests/MarblesTest",
    planedCharacter: "./client/tests/PlanedCharacterTest",
    roadScene: "./client/tests/RoadSceneTest",
    stencilBuffer: "./client/tests/StencilBufferTest",
    characterTest: "./client/tests/CharacterTest",
    simpleTest: "./client/tests/SimpleTest",
    threeEditor: "./client/tests/ThreeEditor",
    gameUI: "./client/GameUI",
};

type SceneKey = keyof typeof scenes;

export type SceneContext = THREE.Scene & {
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    gui: GUI;
    container: HTMLElement;
    controls: OrbitControls;
}

export type SceneInitFunction = (context: SceneContext) => SceneInitResult | void;

export type SceneInitResult = {
    animate?: (elapsedTime: number) => void;
};

const root = document.getElementById('root-container') || document.body;

let currentSceneKey = (localStorage.getItem(LOCAL_STORAGE_SCENE_KEY) as SceneKey) || DEFAULT_SCENE_KEY;
if (!scenes[currentSceneKey]) {
    currentSceneKey = DEFAULT_SCENE_KEY;
}

render(() => <div class="root" style="width:100%; height: 100%; position: relative;" ref={el => el && setupScene(el, currentSceneKey)} />, root);

async function setupScene(container: HTMLElement, sceneKeyToLoad: SceneKey) {
    let sceneInitFunction: SceneInitFunction | undefined;
    let sceneCleanup: () => void = () => { }; // Default empty cleanup
    try {
        if (!scenes[sceneKeyToLoad]) {
            throw new Error(`Invalid scene key: ${sceneKeyToLoad}`);
        }
        const sceneModule = await import(scenes[sceneKeyToLoad]);
        if (!sceneModule || typeof sceneModule.default !== 'function') {
            console.error(`Scene module for key: ${sceneKeyToLoad} does not have a default export function.`);
            container.textContent = `Error in scene module: ${sceneKeyToLoad}. Check console.`;
            return;
        }
        sceneInitFunction = sceneModule.default;
    } catch (e) {
        console.error(`Failed to load scene module for key: ${sceneKeyToLoad}`, e);
        container.insertAdjacentText('beforebegin', `Error loading scene: ${sceneKeyToLoad}. Check console.`);
        //return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 200);
    camera.position.set(-2, 5, 5);
    camera.lookAt(10, 0, 5);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 20, 15);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    const renderer = new THREE.WebGLRenderer({ stencil: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Clear the container before adding new elements
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    const statsFPS = new Stats();
    statsFPS.showPanel(0);
    statsFPS.dom.style.cssText = 'position:absolute;bottom:0;right:0px;z-index:100;';
    document.body.appendChild(statsFPS.dom);

    const statsMS = new Stats();
    statsMS.showPanel(1);
    statsMS.dom.style.cssText = 'position:absolute;bottom:0;right:80px;z-index:100;';
    document.body.appendChild(statsMS.dom);

    const statsMB = new Stats();
    statsMB.showPanel(2);
    statsMB.dom.style.cssText = 'position:absolute;bottom:0;right:160px;z-index:100;';
    document.body.appendChild(statsMB.dom);

    const allStatsPanels = [statsFPS.dom, statsMS.dom, statsMB.dom];

    const oldGui = document.querySelector('.lil-gui');
    if (oldGui) oldGui.remove(); // Remove previous GUI

    const gui = new GUI();
    const guiParams = {
        showStats: true,
        currentScene: sceneKeyToLoad
    };

    gui.add(guiParams, 'currentScene', Object.keys(scenes))
        .name('Select Scene')
        .onChange((newSceneKey: SceneKey) => {
            localStorage.setItem(LOCAL_STORAGE_SCENE_KEY, newSceneKey);
            renderer.setAnimationLoop(null);
            sceneCleanup(); // Clean up resources from the previous scene
            window.location.reload(); // Simplest way to ensure a fresh start
        });

    gui.add(guiParams, 'showStats').name('Show Stats').onChange((value: boolean) => {
        allStatsPanels.forEach(panel => panel.style.display = value ? 'block' : 'none');
    });

    const sceneContext = scene as SceneContext;
    sceneContext.scene = scene;
    sceneContext.renderer = renderer;
    sceneContext.camera = camera;
    sceneContext.container = container;
    sceneContext.gui = gui;
    sceneContext.controls = controls;

    const resultFromInit = sceneInitFunction?.(sceneContext);
    let sceneAnimationCallback = resultFromInit?.animate;

    const clock = new THREE.Clock();

    renderer.setAnimationLoop(() => {
        statsFPS.begin();
        statsMS.begin();
        statsMB.begin();

        const elapsedTime = clock.getElapsedTime();
        sceneAnimationCallback?.(elapsedTime);
        controls.update();
        renderer.render(scene, camera);

        statsFPS.end();
        statsMS.end();
        statsMB.end();
    });

    const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            camera.aspect = width / height;  // Update aspect ratio
            camera.updateProjectionMatrix(); // Apply changes
            renderer.setSize(width, height);
        }
    });

    resizeObserver.observe(container);
}
