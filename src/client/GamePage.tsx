import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import { GameScene3D } from "./GameScene3D";
import { Page } from './Page';
import { Population } from './Population';
import { GameUIComponent, UIButton } from './GameUIComponent';
import { Signal } from './Signal';
import { placeRandomBuildings } from './placeRandomBuildings';
import { ActiveTool } from './tools/ToolTypes';
import { GameStorage } from './GameStorage';

export default class GamePage extends Page {
    scene3DInstance: GameScene3D | undefined;
    private population3D?: Population;
    private gameStorage?: GameStorage;
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
        this.gameStorage = new GameStorage(scene3D, () => this.population3D);

        const activeTool = new Signal<ActiveTool>('select');
        const [saveName, setSaveName] = createSignal(this.gameStorage.getDefaultName());
        const [saveNames, setSaveNames] = createSignal<string[]>([]);
        const [saveMessage, setSaveMessage] = createSignal('');

        const refreshSaveNames = () => {
            const names = this.gameStorage?.listSaveNames() ?? [];
            setSaveNames(names);
            if (saveName().trim().length === 0 && names.length > 0) {
                setSaveName(names[0]);
            }
        };

        const handleSave = () => {
            if (!this.gameStorage) return;
            const usedName = this.gameStorage.saveGame(saveName());
            setSaveName(usedName);
            refreshSaveNames();
            setSaveMessage(`Saved: ${usedName}`);
        };

        const handleLoad = () => {
            if (!this.gameStorage) return;
            const ok = this.gameStorage.loadGame(saveName());
            setSaveMessage(ok ? `Loaded: ${saveName().trim() || this.gameStorage.getDefaultName()}` : 'Load failed: save not found or invalid');
            if (ok) {
                this.updateRandomTargets();
            }
        };

        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);
            this.population3D = new Population(this.scene);
            this.population3D.init(scene3D.worldMap3D.size.x, scene3D.worldMap3D.size.z);
            const lastSaveName = this.gameStorage?.getLastSaveName();
            const loaded = lastSaveName ? (this.gameStorage?.loadGame(lastSaveName) ?? false) : false;

            if (loaded && lastSaveName) {
                setSaveName(lastSaveName);
                setSaveMessage(`Loaded at startup: ${lastSaveName}`);
            } else {
                this.updateRandomTargets();
                placeRandomBuildings(scene3D.worldMap3D, 10);
            }
            refreshSaveNames();

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
            rightPanel={<>
                <div class="debug-save-title">Debug Saves</div>
                <select
                    class="debug-save-select"
                    value={saveName()}
                    onchange={(event) => setSaveName(event.currentTarget.value)}
                >
                    <option value="">(choose a save)</option>
                    {saveNames().map((name) => <option value={name}>{name}</option>)}
                </select>
                <input
                    class="debug-save-input"
                    value={saveName()}
                    placeholder="Save name"
                    onInput={(event) => setSaveName(event.currentTarget.value)}
                />
                <div class="debug-save-row">
                    <button class="debug-save-btn" onclick={handleSave}>Save</button>
                    <button class="debug-save-btn" onclick={handleLoad}>Load</button>
                </div>
                <div class="debug-save-msg">{saveMessage()}</div>
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
