import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { UIProps, GameUIComponent, UIButton } from '../GameUIComponent';
import { Page } from '../Page';
import { Signal } from '../Signal';
import { ActiveTool } from '../tools/ToolTypes';

export default class RoadBuildTest extends Page {
    scene3DInstance: GameScene3D | undefined;
    uiProps: UIProps | undefined;


    async run() {

        const ToolButton = (toolProps: { tool: ActiveTool; icon: string; }) => {
            return <UIButton
                icon={toolProps.icon}
                selected={activeTool.get() === toolProps.tool}
                onclick={() => {
                    activeTool.set(toolProps.tool);
                    this.scene3DInstance?.setActiveTool(toolProps.tool);
                }} />;
        };


        const activeTool = new Signal<ActiveTool>('road');

        const handleUILoaded = async (uiProps: UIProps): Promise<void> => {
            this.uiProps = uiProps;
            uiProps.activeTool.set(activeTool.get());
            this.scene3DInstance = new GameScene3D(uiProps);
            await this.scene3DInstance.init(this);
            this.scene3DInstance.setActiveTool(activeTool.get());

            console.log("GameUI: Scene3D initialized after UI loaded.");

            uiProps.isLoading.set(false);
        };


        render(() => <GameUIComponent page={this}
            toolbar={<>
                <ToolButton tool="select" icon="select-color" />
                <ToolButton tool="bulldoze" icon="bulldozer-color" />
                <ToolButton tool="road" icon="road-color" />
            </>}
            mapSize={{ x: 40, z: 40 }} onUILoaded={handleUILoaded} />, this.appContainer);

    }


    override loop(elapsed: number): void {
        this.scene3DInstance?.drawFrame(elapsed);
    }

    override cleanup(): void {
    }



}


