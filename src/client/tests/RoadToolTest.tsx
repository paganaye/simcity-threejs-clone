import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import { RoadSegment } from '../RoadSegment';
import type { IRoad } from '../roads/IRoad';

export default class RoadTool extends Page {
    scene3DInstance: GameScene3D | undefined;


    async run() {
        const mapSize = { x: 40, z: 40 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;


        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);

            const roadStyle: IRoad = {
                forward: {
                    roadColor: 'old',
                    lanes: 2,
                    rightKerb: 'line',
                    rightSidewalk: 'grass',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                backward: {
                    roadColor: 'old',
                    lanes: 2,
                    rightKerb: 'line',
                    rightSidewalk: 'grass',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                gapSize: 0,
            };

            const main = new RoadSegment(scene3D.scene, 4, 18, 0, 30, roadStyle);
            //const branchA = new RoadSegment(scene3D.scene, 12, 30, Math.PI / 4, 22, roadStyle);
            //const branchB = new RoadSegment(scene3D.scene, 20, 2, -Math.PI / 4, 22, roadStyle);
            scene3D.roadNetwork.registerSegment(main);
            //scene3D.roadNetwork.registerSegment(branchA);
            //scene3D.roadNetwork.registerSegment(branchB);

            //scene3D.setActiveTool('road');
            //scene3D.clearSelection();

            console.log('[RoadToolTest] Road tool ready. Drag on terrain to create roads, select handles to resize/move, Delete to remove.');


            scene3D.isLoading.set(false);
            this.setCameraView(25, 45, 45, 20, 0, 20);
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


