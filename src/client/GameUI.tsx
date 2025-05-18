import { render } from 'solid-js/web';
import { Accessor, createSignal, Setter, Show } from "solid-js";
import { Scene3D } from "./Scene3D";
import type { SimObject3D } from "./SimObject3D";
import type { SceneContext } from "..";
import "./GameUI.css";
export type ActiveTool = "select" | "bulldoze" | "residential" | "commercial" | "industrial" | "road" | "power-plant" | "power-line";
export interface UIProps {
    gameWindow: HTMLElement;
    setIsLoading: Setter<boolean>;
    isPaused: Accessor<boolean>;
    setIsPaused: Setter<boolean>;
    activeTool: Accessor<ActiveTool>;
    setActiveTool: Setter<ActiveTool>;
    selectedObject: Accessor<SimObject3D | null>;
    setSelectedObject: Setter<SimObject3D | null>;
    setSimMoney: Setter<number>;
    setPopulation: Setter<number>;
    setSimTime: Setter<number>;
    setCityName: Setter<string>;
}
export default function initGameUI(context: SceneContext) {
    const { container } = context;
    let scene3DInstance: Scene3D | undefined;

    function GameUIComponent(props: {
        onUILoaded: (uiProps: UIProps) => void
    }) {
        const [isLoading, setIsLoading] = createSignal(true);
        const [isPaused, setIsPaused] = createSignal(false);
        const [activeTool, setActiveTool] = createSignal<ActiveTool>('select');
        const [selectedObject, setSelectedObject] = createSignal<SimObject3D | null>(null);
        const [simMoney, setSimMoney] = createSignal(0);
        const [population, setPopulation] = createSignal(0);
        const [simTime, setSimTime] = createSignal(0);
        const [cityName, setCityName] = createSignal('My City');

        props.onUILoaded({
            gameWindow: context.container,
            setIsLoading,
            isPaused,
            setIsPaused,
            activeTool,
            setActiveTool,
            selectedObject,
            setSelectedObject,
            setSimMoney,
            setPopulation,
            setSimTime,
            setCityName,
        });



        function UIButton(propsBtn: { icon: string, selected: boolean, onclick: (() => void) }) {
            return <button class={"ui-button" + (propsBtn.selected ? " selected" : "")}
                onclick={_ => propsBtn.onclick()} >
                <img class="toolbar-icon" src={`./icons/${propsBtn.icon}.png`} alt={propsBtn.icon} />
            </button >;
        }
        function ToolButton(toolProps: { tool: ActiveTool, icon: string }) {
            return <UIButton
                icon={toolProps.icon}
                selected={activeTool() === toolProps.tool}
                onclick={() => {
                    setActiveTool(toolProps.tool);
                }} />;
        }
        return (
            <div class="ui-root">
                <Show when={isLoading()}>
                    <div id="loading" class="text-overlay"><div>LOADING...</div></div>
                </Show>
                <Show when={isPaused()}>
                    <div id="paused-text" class="text-overlay"><div>PAUSED</div></div>
                </Show>
                <div id="title-bar">
                    <div class="title-bar-left-items title-bar-items">${simMoney()}</div>
                    <div class="title-bar-center-items title-bar-items">
                        <span id="city-name">{cityName()}</span>
                        <span>&nbsp;-&nbsp;</span>
                        <span id="sim-time">{simTime()}</span>
                    </div>
                    <div class="title-bar-right-items title-bar-items">
                        <img id="population-icon" src="./icons/person.png" alt="population" />
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
                </div>
                <div id="info-panel" class="container" style={`display:${selectedObject() ? 'block' : 'none'}`}>
                    <div>{(selectedObject() as any)?.toHTML?.() || 'Info Panel Content'}</div>
                </div>
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


    const handleUILoaded = (uiProps: UIProps): void => {


        scene3DInstance = new Scene3D(uiProps);
        scene3DInstance.init(context);

        console.log("GameUI: Scene3D initialized after UI loaded.");
        uiProps.setIsLoading(false);
    };


    render(() => <GameUIComponent onUILoaded={handleUILoaded} />, container);

    return {
        animation: (elapsedTime: number) => {
            scene3DInstance?.drawFrame(elapsedTime);
        }
    };
}
