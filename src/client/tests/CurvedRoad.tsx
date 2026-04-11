import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import { RoadBuilder } from '../RoadBuilder';
import type { IRoad } from '../roads/IRoad';

export default class RoadTest extends Page {
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
                    lanes: 3,
                    rightKerb: 'line',
                    rightSidewalk: 'small',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                gapSize: 0,
            };



            RoadBuilder.createStraightRoad({
                start: { x: 0, y: 0, z: 25, angle: 0 },
                scene: scene3D.scene,
                length: 35,
                options: road1.forward,
                cuts: {
                    endCut: {
                        left: 4,
                        roadLeft: 4,
                        roadRight: 1,
                        right: 0,
                    }
                }
            });

            RoadBuilder.createStraightRoad({
                start: { x: 25, y: 0, z: 25, angle: Math.PI / 2 },
                scene: scene3D.scene,
                length: 25,
                options: road1.forward
            });


            scene3D.isLoading.set(false);
            this.setCameraView(20, 40, 40, 20, 0, 20);
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


