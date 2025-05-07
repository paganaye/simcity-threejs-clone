import "./main.css";
import { AssetManager } from "./scripts/assets/assetManager";
import { Game } from "./scripts/game"
import { City } from "./scripts/sim/city";
import { GameUiView, GameUI } from "./scripts/ui"

/**
   * Global instance of the asset manager
   */



export let ui: GameUI;
export let assetManager: AssetManager;
export let city: City;
export let game: Game;

export default function App() {
    assetManager = new AssetManager();
    ui = new GameUI();
    city = new City();
    game = new Game();


    assetManager.init(() => {
        city.init(16)
        game.init(city);

    });

    return <>
        <GameUiView ui={ui} />
    </>
}
