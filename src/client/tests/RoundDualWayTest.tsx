import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import type { IDualRoadType, IRoadType } from '../roads/IRoad';
import { RoadSegment } from '../roads/RoadSegment';

export default class RoundDualWayTest extends Page {
    gameScene3D: GameScene3D | undefined;
    private minuteSegment?: RoadSegment;
    private secondSegment?: RoadSegment;
    //    private joinSegment?: RoadSegment;

    async run() {
        const mapSize = { x: 48, z: 48 };
        const gameScene3D = new GameScene3D(mapSize);
        this.gameScene3D = gameScene3D;


        const handleUILoaded = async (): Promise<void> => {
            await gameScene3D.init(this);

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
                gapSize: 0.1,
            };

            const centerX = 24;
            const centerZ = 24;

            this.minuteSegment = new RoadSegment(
                gameScene3D,
                { x: centerX, z: centerZ },
                { x: centerX + 30, z: centerZ },
                dualWayRoad,
            );

            this.secondSegment = new RoadSegment(
                gameScene3D,
                { x: centerX, z: centerZ - 40 },
                { x: centerX, z: centerZ },
                dualWayRoad,
            );

            this.gameScene3D?.roadNetwork.checkJoiningArcs(this.minuteSegment);
            console.log('[RoundDualWayTest] Two road segments (2-way) rotate like clock hands.');

            gameScene3D.isLoading.set(false);
            this.setCameraView(24, 44, 44, centerX, 0, centerZ);
        };


        render(() => <GameUIComponent page={this}
            scene3D={gameScene3D}
            mapSize={mapSize} onUILoaded={handleUILoaded} />, this.appContainer);

    }


    override loop(elapsed: number): void {
        const centerX = 24;
        const centerZ = 24;

        if (this.minuteSegment && this.secondSegment && this.gameScene3D) {
            elapsed /= 2; // slow down a bit
            const minuteAngle = elapsed * 0.5;
            const secondAngle = elapsed * 2.6;
            this.#rotateSegmentFromStart(this.minuteSegment, centerX, centerZ, minuteAngle);
            this.#rotateSegmentToEnd(this.secondSegment, centerX, centerZ, secondAngle);
            this.gameScene3D?.roadNetwork.checkJoiningArcs(this.minuteSegment);
        }

        this.gameScene3D?.drawFrame(elapsed);
    }


    #rotateSegmentFromStart(segment: RoadSegment, centerX: number, centerZ: number, angle: number): void {
        segment.moveTo({ x: centerX, z: centerZ }, angle);
    }

    #rotateSegmentToEnd(segment: RoadSegment, centerX: number, centerZ: number, angle: number): void {
        let length = segment.length;
        segment.moveTo(
            {
                x: centerX - Math.cos(angle) * length,
                z: centerZ + Math.sin(angle) * length,
            },
            angle,
        );
    }




}


