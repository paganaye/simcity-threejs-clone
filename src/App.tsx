import { onMount } from "solid-js";
import "./main.css";
import { AssetManager } from "./scripts/assets/assetManager";
import { Game } from "./scripts/game"
import { City } from "./scripts/sim/city";
import { GameUI } from "./scripts/ui"

/**
   * Global instance of the asset manager
   */



export const ui = new GameUI();
export const assetManager = new AssetManager();
export const city = new City();
export const game = new Game();

onMount(() => {
    assetManager.init(() => {
        city.init(16)
        game.init(city);


    });
})

export default function App() {
    return <>
        <div id="root-window">
            {/* Three.js adds a `canvas` element to this element */}
            <div id="render-target"></div>
            <div id="loading" class="text-overlay">
                <div>
                    LOADING...
                </div>
            </div>
            <div id="paused-text" class="text-overlay" style="visibility: hidden;">
                <div>
                    PAUSED
                </div>
            </div>
            <div id="ui">
                <div id="title-bar">
                    <div class="title-bar-left-items title-bar-items">
                        $1000
                    </div>
                    <div class="title-bar-center-items title-bar-items">
                        <span id="city-name">My City</span>
                        <span>&nbsp;-&nbsp;</span>
                        <span id="sim-time">1/1/2023</span>
                    </div>
                    <div class="title-bar-right-items title-bar-items">
                        <img id="population-icon" src="./icons/person.png" />
                        <span id="population-counter">0</span>
                    </div>
                </div>
                <div id="ui-toolbar" class="container">
                    <button id='button-select' class="ui-button selected" data-type="select"
                        onclick={event => ui.onToolSelected(event)} >
                        <img class="toolbar-icon" src="./icons/select-color.png" />
                    </button>
                    <button id='button-bulldoze' class="ui-button" data-type="bulldoze"
                        onclick={event => ui.onToolSelected(event)}>
                        <img class="toolbar-icon" src="./icons/bulldozer-color.png" />
                    </button>
                    <button id='button-residential' class="ui-button" data-type="residential"
                        onclick={event => ui.onToolSelected(event)}>
                        <img class="toolbar-icon" src="./icons/house-color.png" />
                    </button>
                    <button id='button-commercial' class="ui-button" data-type="commercial"
                        onclick={event => ui.onToolSelected(event)}>
                        <img class="toolbar-icon" src="./icons/store-color.png" />
                    </button>
                    <button id='button-industrial' class="ui-button" data-type="industrial"
                        onclick={event => ui.onToolSelected(event)}>
                        <img class="toolbar-icon" src="./icons/factory-color.png" />
                    </button>
                    <button id='button-road' class="ui-button" data-type="road"
                        onclick={event => ui.onToolSelected(event)}>
                        <img class="toolbar-icon" src="./icons/road-color.png" />
                    </button>
                    <button id='button-power-plant' class="ui-button" data-type="power-plant"
                        onclick={event => ui.onToolSelected(event)}>
                        <img class="toolbar-icon" src="./icons/power-color.png" />
                    </button>
                    <button id='button-power-line' class="ui-button" data-type="power-line"
                        onclick={event => ui.onToolSelected(event)}>
                        <img class="toolbar-icon" src="./icons/power-line-color.png" />
                    </button>
                    <button id='button-pause' class="ui-button" onclick={() => ui.togglePause()}>
                        <img id='pause-button-icon' class="toolbar-icon" src="./icons/pause-color.png" />
                    </button>
                </div>
                <div id="info-panel" class="container">
                </div>
                <div id="instructions">
                    INTERACT - Left Mouse<br />
                    ROTATE - Right Mouse<br />
                    PAN - Control + Right Mouse<br />
                    ZOOM - Scroll
                </div>
                <div id="version">
                    v0.3.0
                </div>
            </div>
        </div>
    </>
}
