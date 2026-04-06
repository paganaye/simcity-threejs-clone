import { render } from 'solid-js/web';
import { Scene3D } from "./Scene3D";
import "./GameUI.css";
import { Page } from './Page';
import { Population } from './Population';
import { GameUIComponent, UIProps } from './GameUIComponent';
export type ActiveTool = "select" | "bulldoze" | "residential" | "commercial" | "industrial" | "road" | "power-plant" | "power-line";

export default class GamePage extends Page {
    scene3DInstance: Scene3D | undefined;
    private population3D?: Population;

    async run() {

        const handleUILoaded = async (uiProps: UIProps): Promise<void> => {
            this.scene3DInstance = new Scene3D(uiProps);
            await this.scene3DInstance.init(this);
            this.population3D = new Population(this.scene);
            this.population3D.init(this.scene3DInstance.worldMap3D.width, this.scene3DInstance.worldMap3D.height);

            console.log("GameUI: Scene3D initialized after UI loaded.");
            uiProps.isLoading.set(false);
        };


        render(() => <GameUIComponent page={this} onUILoaded={handleUILoaded} />, this.appContainer);

    }

    override loop(elapsed: number): void {
        this.scene3DInstance?.drawFrame(elapsed);
        if (this.scene3DInstance) {
            this.population3D?.tick(elapsed);
        }
    }

    override cleanup(): void {
        this.population3D?.dispose();
        this.population3D = undefined;
    }


}
