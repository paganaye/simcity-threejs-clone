import "./main.css";
import { AssetManager } from "./scripts/assets/assetManager";
import { Game } from "./scripts/game"
import { City } from "./scripts/sim/city";
import { GameUiView, GameUI } from "./scripts/ui"

/**
   * Global instance of the asset manager
   */



export let assetManager = new AssetManager();
export let ui: GameUI = new GameUI();
export let city = new City();
export let game = new Game();

export default function App() {
    assetManager.init(() => {
        city = city;
        if (!game.storage.loadGame()) {
            city.init(16, game.storage.getDefaultName())
        }
        game.init();

    });

    return <>
        <GameUiView ui={ui} />
    </>
}
