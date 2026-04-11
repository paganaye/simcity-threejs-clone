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
                start: { x: 0, y: 0, z: 0, angle: 0 },
                scene: scene3D.scene,
                length: 30,
                options: road1.forward,
                gapSize: road1.gapSize,
                cuts: {
                    startCut: {
                        left: 4,
                        roadLeft: 2,
                        roadRight: 0,
                        right: 1,
                    },
                    endCut: {
                        left: 4,
                        roadLeft: 2,
                        roadRight: 0,
                        right: 1,
                    },
                    rightCuts: [
                        {
                            from: 7,
                            roadFrom: 10,
                            roadTo: 17,
                            to: 20,
                        }
                    ],
                    leftCuts: [
                        {
                            from: 5,
                            roadFrom: 6,
                            roadTo: 7,
                            to: 8,
                        },
                        {
                            from: 15,
                            roadFrom: 16,
                            roadTo: 17,
                            to: 18,
                        }
                    ],
                }
            });

            // const road2: IRoad = {
            //     forward: {
            //         roadColor: 'new',
            //         lanes: 2,
            //         rightKerb: 'line',
            //         rightSidewalk: 'grass',
            //         laneWidth: 'normal',
            //         leftKerb: 'line',
            //         leftSidewalk: 'grass',
            //     },
            //     gapSize: 0,
            // };

            // RoadBuilder.createStraightRoad({
            //     start: { x: 0, y: 0, z: 30, angle: degToRad(45) },
            //     scene: scene3D.scene,
            //     length: 15,
            //     options: road2.forward,
            //     gapSize: road2.gapSize,
            //     cuts: {
            //         startCut: {
            //             left: 4,
            //             roadLeft: 2,
            //             roadRight: 0,
            //             right: 1,
            //         },
            //         endCut: {
            //             left: 4,
            //             roadLeft: 2,
            //             roadRight: 0,
            //             right: 1,
            //         }
            //     }
            // });
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


