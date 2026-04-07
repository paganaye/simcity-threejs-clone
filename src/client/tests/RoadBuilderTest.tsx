import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent, UIButton } from '../GameUIComponent';
import { Page } from '../Page';
import { Signal } from '../Signal';
import { ActiveTool } from '../tools/ToolTypes';

export default class RoadBuildTest extends Page {
    scene3DInstance: GameScene3D | undefined;


    async run() {
        const mapSize = { x: 40, z: 40 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;

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

        const handleUILoaded = async (): Promise<void> => {
            scene3D.activeTool.set(activeTool.get());
            await scene3D.init(this);
            scene3D.setActiveTool(activeTool.get());

            console.log("GameUI: Scene3D initialized after UI loaded.");

            scene3D.isLoading.set(false);
        };


        render(() => <GameUIComponent page={this}
            scene3D={scene3D}
            toolbar={<>
                <ToolButton tool="select" icon="select-color" />
                <ToolButton tool="bulldoze" icon="bulldozer-color" />
                <ToolButton tool="road" icon="road-color" />
            </>}
            mapSize={mapSize} onUILoaded={handleUILoaded} />, this.appContainer);

    }


    override loop(elapsed: number): void {
        this.scene3DInstance?.drawFrame(elapsed);
    }

    override cleanup(): void {
    }



}


