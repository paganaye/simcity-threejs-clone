
/* @refresh reload */
import { render } from 'solid-js/web';
import { GameUI, UIProps } from "./client/GameUI";
import { Game3D } from './client/Game3D';

// import "./sim/TestQuadTree.ts";

async function onUILoaded(uiProps: UIProps) {
    let game = new Game3D(uiProps);
    game.init();
}


const root = document.getElementById('root');
render(() => <GameUI onUILoaded={onUILoaded} />, root || document.body);
