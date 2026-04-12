import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import { RoadTextureBuilder } from '../textures/RoadTextureBuilder';
import type { IRoadType } from '../roads/IRoad';
import { StraightRoadPrimitive } from '../roads/StraightRoadPrimitive';
import { CurvedRoadPrimitive } from '../roads/CurvedRoadPrimitive';

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
                rightKerb: 'line',
                rightSidewalk: 'grass',
                laneWidth: 'normal',
                leftKerb: 'line',
                leftSidewalk: 'small',

            };

            const straight = StraightRoadPrimitive.createRoadMesh({
                start: { x: 0, y: 0, z: 20, angle: 0 },
                length: 10,
                roadType: road1,
                material: RoadTextureBuilder.getRoadMaterial(road1),
            });
            if (straight) scene3D.scene.add(straight);


            const arc1 = CurvedRoadPrimitive.createRoadMesh({
                start: { x: 10, y: 0, z: 20, angle: 0 },
                radius: 10,
                sweepAngle: -Math.PI / 2,
                roadType: road1,
                material: RoadTextureBuilder.getRoadMaterial(road1),
                y: 0,
                segmentLength: 1.5,
            });
            if (arc1) scene3D.scene.add(arc1);



            const arc2 = CurvedRoadPrimitive.createRoadMesh({
                start: { x: 10, y: 0, z: 20, angle: 0 },
                radius: 10,
                sweepAngle: Math.PI / 2,
                roadType: road1,
                material: RoadTextureBuilder.getRoadMaterial(road1),
                y: 0,
                segmentLength: 1.5,
            });
            if (arc2) scene3D.scene.add(arc2);

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


