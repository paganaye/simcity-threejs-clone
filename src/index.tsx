import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
/* @refresh reload */
import { render } from 'solid-js/web';

import Stats from 'stats.js';
import { GUI } from 'lil-gui';

const DEFAULT_SCENE_KEY: SceneKey = "gameUI"; // Votre valeur par défaut
const LOCAL_STORAGE_SCENE_KEY = 'game_scene';

const scenes = {
    shaderTest: "./client/tests/ShaderTest",
    planedCharacter: "./client/tests/PlanedCharacterTest",
    roadScene: "./client/tests/RoadSceneTest",
    stencilBuffer: "./client/tests/StencilBufferTest",
    characterTest: "./client/tests/CharacterTest",
    simpleTest: "./client/tests/SimpleTest",
    gameUI: "./client/GameUI", // Votre scène de jeu principale
};

type SceneKey = keyof typeof scenes;

export type SceneContext = THREE.Scene & {
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    gui: GUI;
    container: HTMLElement; // Ajout du conteneur DOM
}

export type SceneInitFunction = (context: SceneContext) => SceneInitResult | void;
export type SceneInitResult = { animate?: (elapsedTime: number) => void, };


const root = document.getElementById('root') || document.body;

let currentSceneKey = (localStorage.getItem(LOCAL_STORAGE_SCENE_KEY) as SceneKey) || DEFAULT_SCENE_KEY;
if (!scenes[currentSceneKey]) {
    currentSceneKey = DEFAULT_SCENE_KEY;
}

render(() => <div ref={el => el && setupScene(el, currentSceneKey)} />, root);

async function setupScene(container: HTMLElement, sceneKeyToLoad: SceneKey) {
    let sceneInitFunction: SceneInitFunction;
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
        container.textContent = `Error loading scene: ${sceneKeyToLoad}. Check console.`;
        return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    if (sceneKeyToLoad !== "shaderTest") { // shaderTest configure sa propre caméra
        camera.position.set(-2, 15, 15);
        camera.lookAt(0, 0, 0);
    }

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

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    const statsFPS = new Stats(); statsFPS.showPanel(0); statsFPS.dom.style.cssText = 'position:absolute;top:0;left:0;z-index:100;'; document.body.appendChild(statsFPS.dom);
    const statsMS = new Stats(); statsMS.showPanel(1); statsMS.dom.style.cssText = 'position:absolute;top:0;left:80px;z-index:100;'; document.body.appendChild(statsMS.dom);
    const statsMB = new Stats(); statsMB.showPanel(2); statsMB.dom.style.cssText = 'position:absolute;top:0;left:160px;z-index:100;'; document.body.appendChild(statsMB.dom);
    const allStatsPanels = [statsFPS.dom, statsMS.dom, statsMB.dom];

    const oldGui = document.querySelector('.lil-gui');
    if (oldGui) oldGui.remove();
    const gui = new GUI();
    const guiParams = {
        showStats: true,
        currentScene: sceneKeyToLoad
    };

    gui.add(guiParams, 'currentScene', Object.keys(scenes))
        .name('Select Scene')
        .onChange((newSceneKey: SceneKey) => {
            localStorage.setItem(LOCAL_STORAGE_SCENE_KEY, newSceneKey);
            renderer.setAnimationLoop(null); // Arrêter la boucle actuelle avant de recharger
            window.location.reload();
        });

    gui.add(guiParams, 'showStats').name('Show Stats').onChange((value: boolean) => {
        allStatsPanels.forEach(panel => panel.style.display = value ? 'block' : 'none');
    });

    // Création du contexte avec le 'container'
    const sceneContext = scene as SceneContext;
    sceneContext.scene = scene;
    sceneContext.renderer = renderer;
    sceneContext.camera = camera;
    sceneContext.container = container;

    const resultFromInit = sceneInitFunction(sceneContext);
    let sceneAnimationCallback = resultFromInit?.animate;

    const clock = new THREE.Clock();

    renderer.setAnimationLoop(() => { // timestamp est optionnel si non utilisé
        statsFPS.begin(); statsMS.begin(); statsMB.begin();

        const elapsedTime = clock.getElapsedTime();
        sceneAnimationCallback?.(elapsedTime);

        controls.update();
        renderer.render(scene, camera);

        statsFPS.end(); statsMS.end(); statsMB.end();
    });
    const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;

            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }
    });
    resizeObserver.observe(container);
}
