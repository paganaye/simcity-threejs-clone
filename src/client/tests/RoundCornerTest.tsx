import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import { RoadSegment } from '../roads/RoadSegment';
import type { IRoad } from '../roads/IRoad';

export default class RoundCornerTest extends Page {
    scene3DInstance: GameScene3D | undefined;
    private minuteRoad?: RoadSegment;
    private secondRoad?: RoadSegment;


    async run() {
        const mapSize = { x: 48, z: 48 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;


        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);

            const roadStyle: IRoad = {
                forward: {
                    roadColor: 'old',
                    lanes: 1,
                    rightKerb: 'line',
                    rightSidewalk: 'grass',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                backward: {
                    roadColor: 'old',
                    lanes: 1,
                    rightKerb: 'line',
                    rightSidewalk: 'grass',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                gapSize: 5,
            };

            const centerX = 24;
            const centerZ = 24;
            this.minuteRoad = new RoadSegment(scene3D.scene, centerX, centerZ, 0, 30, roadStyle);
            this.secondRoad = new RoadSegment(scene3D.scene, centerX, centerZ, Math.PI / 2, 40, roadStyle);
            scene3D.roadNetwork.registerSegment(this.minuteRoad);
            scene3D.roadNetwork.registerSegment(this.secondRoad);
            scene3D.roadNetwork.joinArc(this.minuteRoad, this.secondRoad);

            console.log('[CurvedRoadTest] Two straight roads rotate like clock hands to validate endpoint join rounding.');

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

        if (this.minuteRoad && this.secondRoad && this.scene3DInstance) {
            elapsed /= 50; // convert to seconds
            const minuteAngle = elapsed * 0.5;
            const secondAngle = elapsed * 2.6;
            this.minuteRoad.moveTo(centerX, centerZ, minuteAngle);
            this.secondRoad.moveTo(centerX, centerZ, secondAngle);
            this.scene3DInstance.roadNetwork.joinArc(this.minuteRoad, this.secondRoad);
        }

        this.scene3DInstance?.drawFrame(elapsed);
    }

    override cleanup(): void {
        this.scene3DInstance?.roadNetwork.clear();
        this.minuteRoad = undefined;
        this.secondRoad = undefined;
    }



}


