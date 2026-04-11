import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import { RoadBuilder } from '../RoadBuilder';
import type { IRoadOptions } from '../roads/IRoad';

export default class RoadTest extends Page {
    scene3DInstance: GameScene3D | undefined;


    async run() {
        const mapSize = { x: 40, z: 40 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;


        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);

            const road1: IRoadOptions = {
                roadColor: 'old',
                lanes: 3,
                rightKerb: 'line',
                rightSidewalk: 'grass',
                laneWidth: 'normal',
                leftKerb: 'line',
                leftSidewalk: 'small',

            };

            RoadBuilder.createStraightRoad({
                start: { x: 0, y: 0, z: 15, angle: 0 },
                scene: scene3D.scene,
                length: 10,
                options: road1,
            });


            RoadBuilder.createArcRoad({
                start: { x: 10, y: 0, z: 29.3, angle: 0 },
                radius: 25,
                sweepAngle: -Math.PI / 2,
                scene: scene3D.scene,
                options: road1,
                segmentLength: 1.5,
            })


            RoadBuilder.createStraightRoad({
                start: { x: 20.7, y: 0, z: 4.3, angle: Math.PI / 2 },
                scene: scene3D.scene,
                length: 5,
                options: road1,
            });

            RoadBuilder.createArcRoad({
                start: { x: 10, y: 0, z: 29.3, angle: 0 },
                radius: 25,
                sweepAngle: Math.PI / 2,
                scene: scene3D.scene,
                options: road1,
                segmentLength: 1.5,
            })

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


