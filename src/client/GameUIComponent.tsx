import { JSX, Show, onMount } from 'solid-js';
import { Page } from './Page';
import { SelectedObjectPanel } from './SelectedObjectPanel';
import { GameScene3D } from './GameScene3D';

export interface IFloorPos {
    x: number;
    z: number;
}
export type IFloorSize = IFloorPos;

export function GameUIComponent(props: {
    page: Page;
    onUILoaded?: () => void | Promise<void>;
    toolbar?: JSX.Element;
    mapSize: IFloorSize;
    scene3D: GameScene3D;
}) {
    onMount(() => {
        void props.onUILoaded?.();
    });

    return (
        <div class="ui-root">
            <Show when={props.scene3D.isLoading.get()}>
                <div id="loading" class="text-overlay"><div>LOADING...</div></div>
            </Show>
            <Show when={props.scene3D.isPaused.get()}>
                <div id="paused-text" class="text-overlay"><div>PAUSED</div></div>
            </Show>
            <div id="title-bar">
                <div class="title-bar-left-items title-bar-items">${props.scene3D.simMoney.get()}</div>
                <div class="title-bar-center-items title-bar-items">
                    <span id="city-name">{props.scene3D.cityName.get()}</span>
                    <span>&nbsp;-&nbsp;</span>
                    <span id="sim-time">{props.scene3D.simTime.get()}</span>
                </div>
                <div class="title-bar-right-items title-bar-items">
                    <img id="population-icon" src="./icons/person.png" alt="population" />
                    <span id="population-counter">{props.scene3D.population.get()}</span>
                </div>
            </div>
            <Show when={props.toolbar}>
                <div id="ui-toolbar" class="container">
                    {props.toolbar}
                    <UIButton icon={props.scene3D.isPaused.get() ? "play-color" : "pause-color"} onclick={() => props.scene3D.isPaused.set(!props.scene3D.isPaused.get())} selected={false} />
                </div>
            </Show>
            <SelectedObjectPanel selectedInstance={props.scene3D.selectedInstance.get} selectedCustomObject={props.scene3D.selectedCustomObject.get} />
            <div id="instructions">
                Lorem, ipsum dolor<br />
                sit amet consectetur adipisicing elit.<br />
                Quia neque quam, dignissimos<br />
                ea esse necessitatibus.
            </div>
            <div id="version">v0.3.0</div>
        </div>

    );
}

export function UIButton(propsBtn: { icon: string; selected: boolean; onclick: (() => void); }) {
    return <button class={"ui-button" + (propsBtn.selected ? " selected" : "")}
        onclick={_ => propsBtn.onclick()}>
        <img class="toolbar-icon" src={`./icons/${propsBtn.icon}.png`} alt={propsBtn.icon} />
    </button>;
}

