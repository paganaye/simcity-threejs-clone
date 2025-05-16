import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/* @refresh reload */
import { render } from 'solid-js/web';
import { GameUI, UIProps } from "./client/GameUI";
import { Scene3D } from './client/Scene3D';
import { testScene } from './client/TestScene'

const root = document.getElementById('root') || document.body;

let test = 1;

if (test) {
    function makeTestScene(container: HTMLDivElement) {
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

        let callback = testScene(scene);
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 10, 7.5);
        scene.add(light);

        let clock = new THREE.Clock();

        const animate = () => {
            const elapsedTime = clock.getElapsedTime();
            if (callback) callback(elapsedTime)
            requestAnimationFrame(animate);
            renderer.clearStencil();
            renderer.render(scene, camera);
        };
        animate();
    }
    render(() => (<div ref={el => makeTestScene(el)} />), root);


} else {
    async function onUILoaded(uiProps: UIProps) {
        let scene = new Scene3D(uiProps);
        scene.init();
    }

    render(() => <GameUI onUILoaded={onUILoaded} />, root);
}