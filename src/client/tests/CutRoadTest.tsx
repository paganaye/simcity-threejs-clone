import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import { StraightRoadPrimitive } from '../roads/StraightRoadPrimitive';
import { RoadType } from '../roads/RoadType';

export default class CutRoadTest extends Page {
    scene3DInstance: GameScene3D | undefined;

    async run() {
        const mapSize = { x: 120, z: 100 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;

        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);

            const roadType: RoadType = RoadType.get({
                roadColor: 'old',
                lanes: 1,
                rightKerb: 'line',
                rightSidewalk: 'grass',
                laneWidth: 'normal',
                leftKerb: 'line',
                leftSidewalk: 'small',
            });


            void new StraightRoadPrimitive({
                parent: scene3D.scene,
                transient: false,
                entry: { x: 0, z: 20 },
                exit: { x: 0, z: 80 },
                roadType,
                cuts: {
                    entryCut: {
                        left: 0,
                        roadLeft: 1,
                        middle: -1,
                        roadRight: 1,
                        right: 0,
                    }
                }
            });

            scene3D.isLoading.set(false);
            this.setCameraViewPolar({
                distance: 40,
                azimuthDeg: 90,
                elevationDeg: 45,
                focus: { x: 10, y: 0, z: 60 }  // Centre de ta route
            });
        };

        render(() => <GameUIComponent page={this}
            scene3D={scene3D}
            mapSize={mapSize} onUILoaded={handleUILoaded} />, this.appContainer);
    }

    override loop(elapsed: number): void {
        this.scene3DInstance?.drawFrame(elapsed);
    }
}
