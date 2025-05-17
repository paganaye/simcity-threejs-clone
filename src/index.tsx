import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
/* @refresh reload */
import { render } from 'solid-js/web';
import { Scene3D } from './client/Scene3D';
import { UIProps } from "./client/GameUI";

const sceneKey: SceneKey = "shaderTest";

const scenes = {
    planedCharacter: "./client/tests/PlanedCharacterTest",
    roadScene: "./client/tests/RoadSceneTest",
    stencilBuffer: "./client/tests/StencilBufferTest",
    shaderTest: "./client/tests/ShaderTest",
    gameUI: "./client/GameUI",
};


type SceneKey = keyof typeof scenes;

const root = document.getElementById('root') || document.body;


if ((sceneKey as string) === "gameUI") {
    const { GameUI } = await import(scenes[sceneKey]);
    render(() => <GameUI onUILoaded={gameScene} />, root);
} else {
    render(() => <div ref={el => el && testScene(el)} />, root);
}

async function gameScene(uiProps: UIProps) {
    const scene = new Scene3D(uiProps);
    scene.init()
}

async function testScene(container: HTMLElement) {
    let initScene: (scene: THREE.Scene, renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) => (time: number) => void;
    initScene = (await import(scenes[sceneKey])).default;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(-2, 15, 15);
    camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    const renderer = new THREE.WebGLRenderer({ stencil: true });
    renderer.setSize(width, height);
    new OrbitControls(camera, renderer.domElement);
    container.appendChild(renderer.domElement);

    const callback = initScene(scene, renderer, camera);
    const clock = new THREE.Clock();

    const animate = () => {
        const elapsedTime = clock.getElapsedTime();
        if (callback) callback(elapsedTime);
        requestAnimationFrame(animate);
        renderer.clearStencil();
        renderer.render(scene, camera);
    };
    animate();
}
