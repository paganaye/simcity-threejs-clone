import { JSX, Show } from 'solid-js';
import type { ISelectedInstance } from './editor/CustomGizmo';
import { ActiveTool } from './GamePage';
import { Page } from './Page';
import { SelectedObjectPanel } from './SelectedObjectPanel';
import { Signal } from './Signal';

export interface UIProps {
    gameWindow: HTMLElement;
    isLoading: Signal<boolean>;
    isPaused: Signal<boolean>;
    activeTool: Signal<ActiveTool>;
    selectedInstance: Signal<ISelectedInstance | undefined>;
    simMoney: Signal<number>;
    population: Signal<number>;
    simTime: Signal<number>;
    cityName: Signal<string>;
}

export function GameUIComponent(props: {
    page: Page;
    onUILoaded: (uiProps: UIProps) => void;
    toolbar?: JSX.Element;
}) {
    const isLoading = new Signal(true);
    const isPaused = new Signal(false);
    const activeTool = new Signal<ActiveTool>('select');
    const selectedInstance = new Signal<ISelectedInstance | undefined>(undefined);
    const simMoney = new Signal(0);
    const population = new Signal(0);
    const simTime = new Signal(0);
    const cityName = new Signal('My City');

    props.onUILoaded({
        gameWindow: props.page.appContainer,
        isLoading,
        isPaused,
        activeTool,
        selectedInstance,
        simMoney,
        population,
        simTime,
        cityName,
    });




    return (
        <div class="ui-root">
            <Show when={isLoading.get()}>
                <div id="loading" class="text-overlay"><div>LOADING...</div></div>
            </Show>
            <Show when={isPaused.get()}>
                <div id="paused-text" class="text-overlay"><div>PAUSED</div></div>
            </Show>
            <div id="title-bar">
                <div class="title-bar-left-items title-bar-items">${simMoney.get()}</div>
                <div class="title-bar-center-items title-bar-items">
                    <span id="city-name">{cityName.get()}</span>
                    <span>&nbsp;-&nbsp;</span>
                    <span id="sim-time">{simTime.get()}</span>
                </div>
                <div class="title-bar-right-items title-bar-items">
                    <img id="population-icon" src="./icons/person.png" alt="population" />
                    <span id="population-counter">{population.get()}</span>
                </div>
            </div>
            <Show when={props.toolbar}>
                <div id="ui-toolbar" class="container">
                    {props.toolbar}
                    <UIButton icon={isPaused.get() ? "play-color" : "pause-color"} onclick={() => isPaused.set(!isPaused.get())} selected={false} />
                </div>
            </Show>
            <SelectedObjectPanel selectedInstance={selectedInstance.get} />
            <div id="instructions">
                INTERACT - Left Mouse<br />
                PAN - Right Mouse<br />
                ZOOM - Scroll<br />
                ROTATE - Middle Mouse<br />
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

