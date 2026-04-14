import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import type { IRoadType } from '../roads/IRoad';
import { StraightRoadPrimitive } from '../roads/StraightRoadPrimitive';

export default class RoadTest extends Page {
    scene3DInstance: GameScene3D | undefined;


    async run() {
        const mapSize = { x: 40, z: 40 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;


        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);

            const road1: IRoadType = {
                roadColor: 'old',
                lanes: 3,
                rightSidewalk: 'grass',
                rightKerb: 'line',
                laneWidth: 'normal',
                leftKerb: 'line',
                leftSidewalk: 'small',
            };

            new StraightRoadPrimitive({
                parent: scene3D.scene,
                transient: false,
                start: { x: 0, y: 0, z: 10 },
                end: { x: 30, z: 10 },
                roadType: road1,
                cuts: {
                    entryCut: {
                        left: 4,
                        roadLeft: 2,
                        roadRight: 0,
                        right: 1,
                    },
                    exitCut: {
                        left: 4,
                        roadLeft: 2,
                        roadRight: 2,
                        right: 2,
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
                },
            });

            // const road2: IRoadOptions = {
            //         roadColor: 'new',
            //         lanes: 2,
            //         rightKerb: 'line',
            //         rightSidewalk: 'grass',
            //         laneWidth: 'normal',
            //         leftKerb: 'line',
            //         leftSidewalk: 'grass',
            // };

            // StraightRoadPrimitive.createRoadMesh({
            //     start: { x: 0, y: 0, z: 30, angle: degToRad(45) },
            //     scene: scene3D.scene,
            //     length: 15,
            //     options: road2,
            //     gapSize: 0,
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


