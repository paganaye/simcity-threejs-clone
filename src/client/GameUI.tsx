import { Accessor, createSignal, Setter, Show } from "solid-js";
import { SimObject3D } from "./SimObject3D";


export type ActiveTool = "select" | "bulldoze" | "residential" | "commercial" | "industrial" | "road" | "power-plant" | "power-line";

import "./GameUI.css";

export interface UIProps {
    gameWindow: HTMLDivElement,
    setIsLoading: Setter<boolean>,
    isPaused: Setter<boolean>,
    activeTool: Accessor<ActiveTool>,
    setActiveTool: Setter<ActiveTool>,
    selectedObject: Accessor<SimObject3D | null>,
    setSelectedObject: Setter<SimObject3D | null>,
    setSimMoney: Setter<number>,
    setPopulation: Setter<number>,
    setSimTime: Setter<number>,
    setCityName: Setter<string>
}

export function GameUI(props: { onUILoaded: (uiProps: UIProps) => void }) {
    let [isLoading, setIsLoading] = createSignal(true);
    let [isPaused, setIsPaused] = createSignal(false);
    let [activeTool, setActiveTool] = createSignal<ActiveTool>('select');
    let [selectedObject, setSelectedObject] = createSignal<SimObject3D | null>(null);
    let [simMoney, setSimMoney] = createSignal(0);
    let [population, setPopulation] = createSignal(0);
    let [simTime, setSimTime] = createSignal(0);
    let [cityName, setCityName] = createSignal('My city');

    async function setGameView(gameView: HTMLDivElement) {
        props.onUILoaded({
            gameWindow: gameView,
            setIsLoading,
            isPaused,
            activeTool, setActiveTool,
            selectedObject, setSelectedObject,
            setSimMoney,
            setPopulation,
            setSimTime,
            setCityName
        })
    }

    function UIButton(props: { icon: string, selected: boolean, onclick: (() => void) }) {
        return <button class={"ui-button" + (props.selected ? " selected" : "")}
            onclick={_ => props.onclick()} >
            <img class="toolbar-icon" src={`./icons/${props.icon}.png`} />
        </button >

    }

    function ToolButton(toolProps: { tool: ActiveTool, icon: string }) {
        return <UIButton
            icon={toolProps.icon}
            selected={activeTool() == toolProps.tool}
            onclick={() => {
                setActiveTool(toolProps.tool);
            }} />
    }


    return <>
        <div class="root-window">
            {/* Three.js adds a `canvas` element to this element */}
            <div ref={setGameView} class="game-view" />
            <Show when={isLoading()}>
                <div id="loading" class="text-overlay">
                    <div>
                        LOADING...
                    </div>
                </div>
            </Show>
            <Show when={isPaused()}>
                <div id="paused-text" class="text-overlay">
                    <div>
                        PAUSED
                    </div>
                </div>
            </Show>
            <div id="ui">
                <div id="title-bar">
                    <div class="title-bar-left-items title-bar-items">
                        ${simMoney()}
                    </div>
                    <div class="title-bar-center-items title-bar-items">
                        <span id="city-name">{cityName()}</span>
                        <span>&nbsp;-&nbsp;</span>
                        <span id="sim-time">{simTime()}</span>
                    </div>
                    <div class="title-bar-right-items title-bar-items">
                        <img id="population-icon" src="./icons/person.png" />
                        <span id="population-counter">{population()}</span>
                    </div>
                </div>
                <div id="ui-toolbar" class="container">
                    <ToolButton tool="select" icon="select-color" />
                    <ToolButton tool="bulldoze" icon="bulldozer-color" />
                    <ToolButton tool="residential" icon="house-color" />
                    <ToolButton tool="commercial" icon="store-color" />
                    <ToolButton tool="industrial" icon="factory-color" />
                    <ToolButton tool="road" icon="road-color" />
                    <ToolButton tool="power-plant" icon="power-color" />
                    <ToolButton tool="power-line" icon="power-line-color" />
                    <UIButton icon={isPaused() ? "play-color" : "pause-color"} onclick={() => setIsPaused(!isPaused())} selected={false} />
                    <div id="info-panel" class="container" style={`display:${selectedObject() ? 'block' : 'none'}`}>
                        {selectedObject()?.toHTML()}
                    </div>
                </div>
                <div id="instructions">
                    INTERACT - Left Mouse<br />
                    PAN - Right Mouse<br />
                    ZOOM - Scroll<br />
                    ROTATE - Middle Mouse<br />
                </div>
                <div id="version">
                    v0.3.0
                </div>
            </div>
        </div>
    </>
}