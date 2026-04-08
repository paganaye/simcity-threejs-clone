import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { JunctionBuilder } from '../JunctionBuilder';
import { Page } from '../Page';
import type { IRoad } from '../roads/IRoad';

export default class RoadBuildTest extends Page {
    scene3DInstance: GameScene3D | undefined;


    async run() {
        const mapSize = { x: 40, z: 40 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;


        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);

            const road1: IRoad = {
                forward: {
                    roadColor: 'old',
                    lanes: 1,
                    rightKerb: 'line',
                    rightSidewalk: 'small',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                backward: {
                    roadColor: 'old',
                    lanes: 1,
                    rightKerb: 'line',
                    rightSidewalk: 'small',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                gapSize: 0,
            };

            const road2: IRoad = {
                forward: {
                    roadColor: 'new',
                    lanes: 2,
                    rightKerb: 'emergencyLane',
                    rightSidewalk: 'grass',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                backward: {
                    roadColor: 'new',
                    lanes: 2,
                    rightKerb: 'emergencyLane',
                    rightSidewalk: 'grass',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                gapSize: 0,
            };

            const junctionBuilder = new JunctionBuilder(scene3D.scene);
            junctionBuilder.addCrossJunction({ x: 20, z: 20, angle: 0 },
                road1,
                road2,
                { centerMarking: 'box' });

            console.log("GameUI: Scene3D initialized after UI loaded.");

            scene3D.isLoading.set(false);
            this.camera?.position.set(20, 40, 40);  
            this.camera?.lookAt(20,0,20);
        };


        render(() => <GameUIComponent page={this}
            scene3D={scene3D}
            mapSize={mapSize} onUILoaded={handleUILoaded} />, this.appContainer);

    }


    override loop(elapsed: number): void {
        this.scene3DInstance?.drawFrame(elapsed);
    }

    override cleanup(): void {
    }



}


