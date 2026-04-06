import { render } from 'solid-js/web';
import { GameScene3D } from "./GameScene3D";
import { Page } from './Page';
import { Population } from './Population';
import { GameUIComponent, UIButton, UIProps } from './GameUIComponent';
import { loop } from 'three/tsl';
import { number } from 'zod';
import { Signal } from './Signal';
import { placeRandomBuildings } from './placeRandomBuildings';
export type ActiveTool = "select" | "bulldoze" | "residential" | "commercial" | "industrial" | "road" | "power-plant" | "power-line";

export default class GamePage extends Page {
    scene3DInstance: GameScene3D | undefined;
    private population3D?: Population;


    async run() {

        const activeTool = new Signal<ActiveTool>('select');

        const handleUILoaded = async (uiProps: UIProps): Promise<void> => {
            this.scene3DInstance = new GameScene3D(uiProps);
            await this.scene3DInstance.init(this);
            this.population3D = new Population(this.scene);
            this.population3D.init(this.scene3DInstance.worldMap3D.width, this.scene3DInstance.worldMap3D.height);
            placeRandomBuildings(this.scene3DInstance!.worldMap3D, 100);

            console.log("GameUI: Scene3D initialized after UI loaded.");
            uiProps.isLoading.set(false);
        };


        function ToolButton(toolProps: { tool: ActiveTool; icon: string; }) {
            return <UIButton
                icon={toolProps.icon}
                selected={activeTool.get() === toolProps.tool}
                onclick={() => activeTool.set(toolProps.tool)} />;
        }


        render(() => <GameUIComponent
            toolbar={<>
                <ToolButton tool="select" icon="select-color" />
                <ToolButton tool="bulldoze" icon="bulldozer-color" />
                <ToolButton tool="residential" icon="house-color" />
                <ToolButton tool="commercial" icon="store-color" />
                <ToolButton tool="industrial" icon="factory-color" />
                <ToolButton tool="road" icon="road-color" />
                <ToolButton tool="power-plant" icon="power-color" />
                <ToolButton tool="power-line" icon="power-line-color" />

            </>}
            page={this} onUILoaded={handleUILoaded} />,
            this.appContainer);
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
