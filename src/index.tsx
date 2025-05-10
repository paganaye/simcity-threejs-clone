
/* @refresh reload */
import { render } from 'solid-js/web';
import { GameUI, UIProps } from "./client/GameUI";
import { Scene3D } from './client/Scene3D';

// import "./sim/TestQuadTree.ts";

async function onUILoaded(uiProps: UIProps) {
    let scene = new Scene3D(uiProps);
    scene.init();
}


const root = document.getElementById('root');
render(() => <GameUI onUILoaded={onUILoaded} />, root || document.body);
