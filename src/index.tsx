import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/* @refresh reload */
import { render } from 'solid-js/web';
import { GameUI, UIProps } from "./client/GameUI";
import { Scene3D } from './client/Scene3D';
import { testScene } from './client/TestScene'

const root = document.getElementById('root') || document.body;

let test = 0;

if (test) {
    function makeTestScene(container: HTMLDivElement) {
        const width = window.innerWidth;
        const height = window.innerHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(-5, 5, 0);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        new OrbitControls(camera, renderer.domElement);
        container.appendChild(renderer.domElement);

        testScene(scene)
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 10, 7.5);
        scene.add(light);

        const animate = () => {
            requestAnimationFrame(animate);
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