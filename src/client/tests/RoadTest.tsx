import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import type { IRoad } from '../roads/IRoad';
import { RoadBuilder } from '../RoadBuilder';
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
                    lanes: 1,
                    rightKerb: 'line',
                    rightSidewalk: 'small',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                gapSize: 0,
            };


            const roadBuilder1 = new RoadBuilder({ x: 0, y: 0, z: 10, angle: 0 }, scene3D.scene);
            roadBuilder1.addStraightRoad(35, road1,
                {
                    rightCuts: [
                        {
                            from: 10,
                            roadFrom: 15,
                            roadTo: 35,
                            to: 40
                        }
                    ]
                }
            );
            //roadBuilder1.addStraightRoad(25, road1);

            const roadBuilder2 = new RoadBuilder({ x: 0, y: 0, z: 30, angle: degToRad(45) }, scene3D.scene);
            roadBuilder2.addStraightRoad(20.5, road2, {
                startCut: {
                    left: 10,
                    roadLeft: 10,
                    roadRight: 0,
                    right: 20,
                },
                endCut: {
                    left: 10,
                    roadLeft: 10,
                    roadRight: 0,
                    right: 20,
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


