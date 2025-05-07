import { Game } from "./game";
import { createSignal, Accessor, Setter, Show } from 'solid-js';
import { SimObject } from "./sim/simObject";

type ActiveTool = "select" | "bulldoze" | "residential" | "commercial" | "industrial" | "road" | "power-plant" | "power-line";


export class GameUI {
  isLoading!: Accessor<boolean>;
  setIsLoading!: Setter<boolean>;

  isPaused!: Accessor<boolean>;
  setIsPaused!: Setter<boolean>;

  activeTool!: Accessor<ActiveTool>;
  setActiveTool!: Setter<ActiveTool>;

  cityName!: Accessor<string>;
  setCityName!: Setter<string>;

  populationCounter!: Accessor<number>;
  setPopulationCounter!: Setter<number>;

  simTime!: Accessor<string>;
  setSimTime!: Setter<string>;

  selectedObject!: Accessor<SimObject | null>;
  setSelectedObject!: Setter<SimObject | null>;

  constructor() {
  }

  /** Currently selected tool   */

  selectedControl: HTMLElement | null = document.getElementById('button-select');
  /** True if the game is currently paused */

  gameWindow!: HTMLDivElement;


  /** Toggles the pause state of the game   */
  togglePause() {
    this.setIsPaused(!this.isPaused());
  }

  /** Updates the values in the title bar */
  updateTitleBar(game: Game) {
    this.setCityName(game.city.name);
    this.setPopulationCounter(game.city.population);

    const date = new Date('1/1/2023');
    date.setDate(date.getDate() + game.city.simTime);
    this.setSimTime(date.toLocaleDateString());
  }

}

export function GameUiView(props: { ui: GameUI }) {
  let ui = props.ui;
  [ui.isLoading, ui.setIsLoading] = createSignal(true);
  [ui.isPaused, ui.setIsPaused] = createSignal(false);
  [ui.activeTool, ui.setActiveTool] = createSignal<ActiveTool>("select");
  [ui.cityName, ui.setCityName] = createSignal("");
  [ui.populationCounter, ui.setPopulationCounter] = createSignal(0);
  [ui.simTime, ui.setSimTime] = createSignal("...");
  [ui.selectedObject, ui.setSelectedObject] = createSignal<SimObject | null>(null);

  function UIButton(props: { icon: string, selected: boolean, onclick: (() => void) }) {
    return <button class={"ui-button" + (props.selected ? " selected" : "")}
      onclick={_ => props.onclick()} >
      <img class="toolbar-icon" src={`./icons/${props.icon}.png`} />
    </button >

  }

  function ToolButton(props: { tool: ActiveTool, icon: string }) {
    return <UIButton
      icon={props.icon}
      selected={ui.activeTool() == props.tool}
      onclick={() => {
        ui.setActiveTool(props.tool);
      }} />
  }


  return <>
    <div id="root-window">
      {/* Three.js adds a `canvas` element to this element */}
      <div id="render-target" ref={ui.gameWindow}></div>
      <Show when={props.ui.isLoading()}>
        <div id="loading" class="text-overlay">
          <div>
            LOADING...
          </div>
        </div>
      </Show>
      <Show when={props.ui.isPaused()}>
        <div id="paused-text" class="text-overlay">
          <div>
            PAUSED
          </div>
        </div>
      </Show>
      <div id="ui">
        <div id="title-bar">
          <div class="title-bar-left-items title-bar-items">
            $1000
          </div>
          <div class="title-bar-center-items title-bar-items">
            <span id="city-name">{ui.cityName()}</span>
            <span>&nbsp;-&nbsp;</span>
            <span id="sim-time">{ui.simTime()}</span>
          </div>
          <div class="title-bar-right-items title-bar-items">
            <img id="population-icon" src="./icons/person.png" />
            <span id="population-counter">{ui.populationCounter()}</span>
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
          <UIButton icon={ui.isPaused() ? "play-color" : "pause-color"} onclick={() => ui.togglePause()} selected={false} />
          <div id="info-panel" class="container" style={`display:${ui.selectedObject() ? 'block' : 'none'}`}>
            {ui.selectedObject()?.toHTML()}
          </div>
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