import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { JunctionBuilder } from '../JunctionBuilder';
import { Page } from '../Page';
import type { IRoad } from '../roads/IRoad';
import { degToRad } from 'three/src/math/MathUtils.js';

export default class RoadBuildTest extends Page {
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
                    lanes: 1,
                    rightKerb: 'line',
                    rightSidewalk: 'small',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                backward: {
                    roadColor: 'old',
                    lanes: 1,
                    rightKerb: 'line',
                    rightSidewalk: 'small',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                gapSize: 0,
            };

            const road2: IRoad = {
                forward: {
                    roadColor: 'new',
                    lanes: 2,
                    rightKerb: 'emergencyLane',
                    rightSidewalk: 'grass',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                backward: {
                    roadColor: 'new',
                    lanes: 2,
                    rightKerb: 'emergencyLane',
                    rightSidewalk: 'grass',
                    laneWidth: 'normal',
                    leftKerb: 'line',
                    leftSidewalk: 'small',
                },
                gapSize: 0,
            };

            const junctionBuilder = new JunctionBuilder(scene3D.scene);
            junctionBuilder.addCrossJunction2(
                { x: 20, z: 20, angle: 0 },
                [
                    { type: 'road-out', angle: degToRad(0), widthM: 15, roadOptions: road1.forward },
                    { type: 'road-in', angle: degToRad(90), widthM: 15, roadOptions: road2.backward },
                    { type: 'grass', angle: degToRad(90), widthM: 3 },
                    { type: 'road-out', angle: degToRad(90), widthM: 15, roadOptions: road2.forward },
                    { type: 'road-in', angle: degToRad(170), widthM: 15, roadOptions: road1.forward },
                    { type: 'road-out', angle: degToRad(190), widthM: 15, roadOptions: road1.backward },
                    { type: 'road-in', angle: degToRad(270), widthM: 15, roadOptions: road2.forward },
                    { type: 'road-out', angle: degToRad(270), widthM: 15, roadOptions: road2.backward },
                    { type: 'road-in', angle: degToRad(360), widthM: 15, roadOptions: road1.backward },
                ],
                {
                    centerMarking: 'box',
                    crosswalks: 'zebra',
                },
            );

            console.log("GameUI: Scene3D initialized after UI loaded.");

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


