import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import { RoadBuilder } from '../RoadBuilder';
import type { IRoadOptions } from '../roads/IRoad';

export default class JunctionTest extends Page {
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
                start: { x: 0, y: 0, z: 30, angle: 0 },
                scene: scene3D.scene,
                length: 39,
                options: road1,
            });



            RoadBuilder.createStraightRoad({
                start: { x: 10, y: 0, z: 10, angle: -Math.PI/4 },
                scene: scene3D.scene,
                length: 30,
                options: road1,
            });



            scene3D.isLoading.set(false);
            this.setCameraView(20, 40, 40, 20, 0, 20);
        };


        render(() => <GameUIComponent page={this}
            scene3D={scene3D}
            mapSize={mapSize} onUILoaded={handleUILoaded} />, this.appContainer);

    }





}


