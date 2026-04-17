import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import { StraightRoadPrimitive } from '../roads/StraightRoadPrimitive';
import { RoadJoin } from '../roads/RoadJoin';
import { RoadType } from '../roads/RoadType';

export default class RoundCornerAnglesTest extends Page {
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

            const angleRows = [25, 35, 45, 60, 75, 90];
            let x = 10;
            let z = 10;
            for (let i = 0; i < angleRows.length; i++) {
                const center = { x, z };
                const angleDeg = angleRows[i];
                const angleRad = (angleDeg * Math.PI) / 180;
                const previousLength = 22;
                const nextLength = 28;

                const nextRoad = new StraightRoadPrimitive({
                    parent: scene3D.scene,
                    transient: false,
                    entry: { x: center.x, z: center.z },
                    exit: { x: center.x + nextLength, z: center.z },
                    roadType,
                });

                z += 30;
                if (z >= 100) {
                    z = 10;
                    x += 40;
                }
                const prevAwayX = Math.cos(angleRad);
                const prevAwayZ = Math.sin(angleRad);
                const previousRoad = new StraightRoadPrimitive({
                    parent: scene3D.scene,
                    transient: false,
                    entry: {
                        x: center.x + prevAwayX * previousLength,
                        z: center.z + prevAwayZ * previousLength,
                    },
                    exit: { x: center.x, z: center.z },
                    roadType,
                });

                RoadJoin.joinRoads(scene3D.scene, previousRoad.exit, nextRoad.entry, roadType, { radius: 3.5 });
            }

            console.log('[RoundCornerAnglesTest] Rendered joins for 10, 20, 30 and 40 degrees.');

            scene3D.isLoading.set(false);
            this.setCameraView(30, 100, 30, 30, 0, 29);
        };

        render(() => <GameUIComponent page={this}
            scene3D={scene3D}
            mapSize={mapSize} onUILoaded={handleUILoaded} />, this.appContainer);
    }

    override loop(elapsed: number): void {
        this.scene3DInstance?.drawFrame(elapsed);
    }
}
