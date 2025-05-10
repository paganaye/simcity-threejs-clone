
/* @refresh reload */
import { render } from 'solid-js/web';
import { GameUI, UIProps } from "./client/GameUI";
import { Scene3D } from './client/Scene3D';
import { Test } from './client/Test'

const root = document.getElementById('root') || document.body;

// import "./sim/TestQuadTree.ts";
let test = 1;

if (test) {
    render(() => <Test />, root);
} else {
    async function onUILoaded(uiProps: UIProps) {
        let scene = new Scene3D(uiProps);
        scene.init();
    }

    render(() => <GameUI onUILoaded={onUILoaded} />, root);
}