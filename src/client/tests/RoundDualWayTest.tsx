import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import type { IDualRoadType, IRoadType } from '../roads/IRoad';
import { RoadSegment } from '../roads/RoadSegment';

export default class RoundDualWayTest extends Page {
    scene3DInstance: GameScene3D | undefined;
    private minuteSegment?: RoadSegment;
    private secondSegment?: RoadSegment;
    //    private joinSegment?: RoadSegment;

    async run() {
        const mapSize = { x: 48, z: 48 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;


        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);

            // 2-way road configuration (forward and backward)
            const roadType: IRoadType = {
                roadColor: 'old',
                lanes: 2,
                rightKerb: 'line',
                rightSidewalk: 'grass',
                laneWidth: 'normal',
                leftKerb: 'line',
                leftSidewalk: 'small',
            };
            const dualWayRoad: IDualRoadType = {
                forward: roadType,
                backward: roadType,
                gapSize: 1,
            };

            const centerX = 24;
            const centerZ = 24;
            this.minuteSegment = new RoadSegment(
                scene3D.scene,
                { x: centerX, z: centerZ },
                { x: centerX + 30, z: centerZ },
                dualWayRoad,
            );
            this.secondSegment = new RoadSegment(
                scene3D.scene,
                { x: centerX, z: centerZ - 40 },
                { x: centerX, z: centerZ },
                dualWayRoad,
            );

            console.log('[RoundDualWayTest] Two road segments (2-way) rotate like clock hands.');

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

        if (this.minuteSegment && this.secondSegment && this.scene3DInstance) {
            elapsed /= 2; // slow down a bit
            const minuteAngle = elapsed * 0.5;
            const secondAngle = elapsed * 2.6;
            this.#rotateSegmentFromStart(this.minuteSegment, centerX, centerZ, 30, minuteAngle);
            this.#rotateSegmentToEnd(this.secondSegment, centerX, centerZ, 40, secondAngle);
        }

        this.scene3DInstance?.drawFrame(elapsed);
    }


    #rotateSegmentFromStart(segment: RoadSegment, _centerX: number, centerZ: number, _length: number, angle: number): void {
        segment.moveTo(_centerX, centerZ, angle);
    }

    #rotateSegmentToEnd(segment: RoadSegment, centerX: number, centerZ: number, length: number, angle: number): void {
        segment.moveTo(
            centerX - Math.cos(angle) * length,
            centerZ + Math.sin(angle) * length,
            angle,
        );
    }




}


