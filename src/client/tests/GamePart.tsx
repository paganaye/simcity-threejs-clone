import { render } from 'solid-js/web';
import { GameScene3D } from "../GameScene3D";
import { Page } from '../Page';
import { GameUIComponent, UIProps } from '../GameUIComponent';
import { placeRandomBuildings } from '../placeRandomBuildings';

export default class GamePart extends Page {
    scene3DInstance: GameScene3D | undefined;

    async run() {

        const handleUILoaded = async (uiProps: UIProps): Promise<void> => {
            this.scene3DInstance = new GameScene3D(uiProps);
            await this.scene3DInstance.init(this);

            placeRandomBuildings(this.scene3DInstance!.worldMap3D, 5);
            console.log("GameUI: Scene3D initialized after UI loaded.");

            uiProps.isLoading.set(false);
        };


        render(() => <GameUIComponent page={this} mapSize={{ x: 40, z: 40 }} onUILoaded={handleUILoaded} />, this.appContainer);

    }

    override loop(elapsed: number): void {
        this.scene3DInstance?.drawFrame(elapsed);
    }

    override cleanup(): void {
    }


}
