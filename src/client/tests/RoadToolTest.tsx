import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent, ToolButton } from '../GameUIComponent';
import { Page } from '../Page';
import { RoadSegment } from '../roads/RoadSegment';
import type { IDualRoadType } from '../roads/IRoad';

export default class RoadTool extends Page {
    scene3DInstance: GameScene3D | undefined;


    async run() {
        const mapSize = { x: 40, z: 40 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;
        scene3D.setActiveTool('road');

        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);

            const roadType: IDualRoadType = {
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
                gapSize: 0,
            };

            const main = new RoadSegment(scene3D, { x: 4, z: 18 }, { x: 34, z: 18 }, roadType);
            //const branchA = new RoadSegment(scene3D.scene, { x: 12, z: 30 }, { x: 12 + Math.cos(Math.PI / 4) * 22, z: 30 - Math.sin(Math.PI / 4) * 22 }, roadType);
            //const branchB = new RoadSegment(scene3D.scene, { x: 20, z: 2 }, { x: 20 + Math.cos(-Math.PI / 4) * 22, z: 2 - Math.sin(-Math.PI / 4) * 22 }, roadType);
            scene3D.roadNetwork.addSegment(main);
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
            toolbar={<>
                <ToolButton scene={scene3D} tool="select" icon="select-color" />
                <ToolButton scene={scene3D} tool="bulldoze" icon="bulldozer-color" />
                <ToolButton scene={scene3D} tool="road" icon="road-color" />
            </>}

            mapSize={mapSize} onUILoaded={handleUILoaded} />, this.appContainer);

    }


    override loop(elapsed: number): void {
        this.scene3DInstance?.drawFrame(elapsed);
    }

    override cleanup(): void {
    }



}

