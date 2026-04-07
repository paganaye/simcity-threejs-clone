import { render } from 'solid-js/web';
import { GameScene3D } from "../GameScene3D";
import { Page } from '../Page';
import { GameUIComponent } from '../GameUIComponent';
import { placeRandomBuildings } from '../placeRandomBuildings';

export default class GamePart extends Page {
    scene3DInstance: GameScene3D | undefined;

    async run() {
        const mapSize = { x: 40, z: 40 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;

        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);

            placeRandomBuildings(scene3D.worldMap3D, 5);
            console.log("GameUI: Scene3D initialized after UI loaded.");

            scene3D.isLoading.set(false);
        };


        render(() => <GameUIComponent
            scene3D={scene3D}
            page={this}
            mapSize={mapSize}
            onUILoaded={handleUILoaded} />, this.appContainer);

    }

    override loop(elapsed: number): void {
        this.scene3DInstance?.drawFrame(elapsed);
    }

    override cleanup(): void {
    }


}
