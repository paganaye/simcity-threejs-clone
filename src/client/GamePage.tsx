import { render } from 'solid-js/web';
import { GameScene3D } from "./GameScene3D";
import { Page } from './Page';
import { Population } from './Population';
import { GameUIComponent, UIButton } from './GameUIComponent';
import { Signal } from './Signal';
import { placeRandomBuildings } from './placeRandomBuildings';
import { ActiveTool } from './tools/ToolTypes';

export default class GamePage extends Page {
    scene3DInstance: GameScene3D | undefined;
    private population3D?: Population;
    private static readonly RETARGET_AFTER_WAIT_SECONDS = 5;

    private setRandomTargetForCharacter(character: { setTarget: (target: { x: number; z: number }) => void }): void {
        if (!this.population3D) return;
        const margin = 0.5;
        const minX = margin;
        const minZ = margin;
        const maxX = Math.max(minX, this.population3D.mapWidth - margin);
        const maxZ = Math.max(minZ, this.population3D.mapHeight - margin);
        const x = minX + Math.random() * (maxX - minX);
        const z = minZ + Math.random() * (maxZ - minZ);
        character.setTarget({ x, z });
    }

    private updateRandomTargets(): void {
        if (!this.population3D) return;
        for (const character of this.population3D.characters) {
            const waitedTooLong = character.isBlocked
                && character.waitDuration >= GamePage.RETARGET_AFTER_WAIT_SECONDS;
            if (!character.target || character.isAtTarget() || waitedTooLong) {
                this.setRandomTargetForCharacter(character);
            }
        }
    }


    async run() {
        const mapSize = { x: 256, z: 256 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;

        const activeTool = new Signal<ActiveTool>('select');

        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);
            this.population3D = new Population(this.scene);
            this.population3D.init(scene3D.worldMap3D.size.x, scene3D.worldMap3D.size.z);
            this.updateRandomTargets();
            placeRandomBuildings(scene3D.worldMap3D, 100);

            console.log("GameUI: Scene3D initialized after UI loaded.");
            scene3D.isLoading.set(false);
        };


        let ToolButton = (toolProps: { tool: ActiveTool; icon: string; }) => {
            return <UIButton
                icon={toolProps.icon}
                selected={activeTool.get() === toolProps.tool}
                onclick={() => {
                    activeTool.set(toolProps.tool);
                    this.scene3DInstance?.setActiveTool(toolProps.tool);
                }} />;
        }


        render(() => <GameUIComponent
            scene3D={scene3D}
            mapSize={mapSize}
            toolbar={<>
                <ToolButton tool="select" icon="select-color" />
                <ToolButton tool="bulldoze" icon="bulldozer-color" />
                <ToolButton tool="residential" icon="house-color" />
                <ToolButton tool="road" icon="road-color" />
                <ToolButton tool="power-plant" icon="power-color" />

            </>}
            page={this} onUILoaded={handleUILoaded} />,
            this.appContainer);
    }

    override loop(elapsed: number): void {
        this.scene3DInstance?.drawFrame(elapsed);
        if (this.scene3DInstance?.worldMap3D) {
            this.updateRandomTargets();
            this.population3D?.tick(elapsed);
        }
    }

    override cleanup(): void {
        this.population3D?.dispose();
        this.population3D = undefined;
    }


}
