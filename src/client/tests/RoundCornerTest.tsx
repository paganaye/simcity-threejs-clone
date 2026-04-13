import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import type { IRoadType } from '../roads/IRoad';
//import type { RoadPrimitive } from '../roads/RoadPrimitive';
import { StraightRoadPrimitive } from '../roads/StraightRoadPrimitive';
import { JoiningRoadPrimitive } from '../roads/JoiningRoadPrimitive';

export default class RoundCornerTest extends Page {
    scene3DInstance: GameScene3D | undefined;
    private minutePrimitive?: StraightRoadPrimitive;
    private secondPrimitive?: StraightRoadPrimitive;
    //    private joinPrimitive?: RoadPrimitive;

    async run() {
        const mapSize = { x: 48, z: 48 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;


        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);

            const roadType: IRoadType = {
                roadColor: 'old',
                lanes: 1,
                rightKerb: 'line',
                rightSidewalk: 'grass',
                laneWidth: 'normal',
                leftKerb: 'line',
                leftSidewalk: 'small',
            };

            const centerX = 24;
            const centerZ = 24;
            this.minutePrimitive = new StraightRoadPrimitive({
                parent: scene3D.scene,
                transient: false,
                start: { x: centerX, z: centerZ },
                end: { x: centerX + 30, z: centerZ },
                roadType: roadType,
            });
            this.secondPrimitive = new StraightRoadPrimitive({
                parent: scene3D.scene,
                transient: false,
                start: { x: centerX, z: centerZ - 40 },
                end: { x: centerX, z: centerZ },
                roadType: roadType,
            });

            JoiningRoadPrimitive.joinPrimitives(scene3D.scene, this.minutePrimitive.start, this.secondPrimitive.end, roadType);
            console.log('[CurvedRoadTest] Two road primitives rotate like clock hands.');

            scene3D.isLoading.set(false);
            this.setCameraView(24, 44, 44, centerX, 0, centerZ);
        };


        render(() => <GameUIComponent page={this}
            scene3D={scene3D}
            mapSize={mapSize} onUILoaded={handleUILoaded} />, this.appContainer);

    }


    override loop(elapsed: number): void {
        const centerX = 24;
        const centerZ = 24;

        if (this.minutePrimitive && this.secondPrimitive && this.scene3DInstance) {
            elapsed /= 45; // convert to seconds
            const minuteAngle = elapsed * 0.5;
            const secondAngle = elapsed * 2.6;
            this.#rotatePrimitiveFromStart(this.minutePrimitive, centerX, centerZ, 30, minuteAngle);
            this.#rotatePrimitiveToEnd(this.secondPrimitive, centerX, centerZ, 40, secondAngle);
        }

        this.scene3DInstance?.drawFrame(elapsed);
    }


    #rotatePrimitiveFromStart(primitive: StraightRoadPrimitive, centerX: number, centerZ: number, length: number, angle: number): void {
        primitive.move({ x: centerX, z: centerZ }, {
            x: centerX + Math.cos(angle) * length,
            z: centerZ - Math.sin(angle) * length,
        });
    }

    #rotatePrimitiveToEnd(primitive: StraightRoadPrimitive, centerX: number, centerZ: number, length: number, angle: number): void {
        primitive.move({
            x: centerX - Math.cos(angle) * length,
            z: centerZ + Math.sin(angle) * length,
        }, { x: centerX, z: centerZ });
    }




}


