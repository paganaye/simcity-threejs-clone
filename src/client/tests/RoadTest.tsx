import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import { RoadBuilder } from '../RoadBuilder';
import type { IRoad } from '../roads/IRoad';
import { degToRad } from 'three/src/math/MathUtils.js';

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

            const road2: IRoad = {
                forward: {
                    roadColor: 'new',
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
                start: { x: 0, y: 0, z: 0, angle: 0 },
                scene: scene3D.scene,
                length: 35,
                options: road1.forward,
                gapSize: road1.gapSize,
                cuts: {
                    rightCuts: [
                        {
                            from: 10,
                            roadFrom: 15,
                            roadTo: 35,
                            to: 40
                        }
                    ]
                }
            });

            RoadBuilder.createStraightRoad({
                start: { x: 0, y: 0, z: 30, angle: degToRad(45) },
                scene: scene3D.scene,
                length: 20.5,
                options: road2.forward,
                gapSize: road2.gapSize,
                cuts: {
                    startCut: {
                        left: 6,
                        roadLeft: 5,
                        roadRight: 0,
                        right: 1,
                    },
                    endCut: {
                        left: 3,
                        roadLeft: 2,
                        roadRight: 0,
                        right: 4,
                    }
                }
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


