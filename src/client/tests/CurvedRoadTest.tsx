import { render } from 'solid-js/web';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import type { IRoadType } from '../roads/IRoad';
import { CurvedRoadPrimitive } from '../roads/CurvedRoadPrimitive';
import { RoadType } from '../roads/RoadType';

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
            const road2: IRoadType = {
                roadColor: 'new',
                lanes: 2,
                rightKerb: 'line',
                rightSidewalk: 'grass',
                laneWidth: 'normal',
                leftKerb: 'line',
                leftSidewalk: 'small',

            };

            const createArcPrimitive = (params: {
                start: { x: number; z: number; angle: number };
                radius: number;
                sweepAngle: number;
                roadType: IRoadType;
            }) => {
                const safeRadius = Math.max(0.001, Math.abs(params.radius));
                const safeSweepAngle = Number.isFinite(params.sweepAngle) ? params.sweepAngle : 0;
                if (Math.abs(safeSweepAngle) < 1e-6) return null;

                const leftNormalX = Math.sin(params.start.angle);
                const leftNormalZ = Math.cos(params.start.angle);
                const turnDirection = safeSweepAngle < 0 ? -1 : 1;
                const center = {
                    x: params.start.x + leftNormalX * safeRadius * turnDirection,
                    z: params.start.z + leftNormalZ * safeRadius * turnDirection,
                };

                const curveSweepAngle = -safeSweepAngle;
                const radialSign = -turnDirection;
                const pointAt = (t: number) => {
                    const tangentAngle = params.start.angle + curveSweepAngle * t;
                    const leftN = { x: Math.sin(tangentAngle), z: Math.cos(tangentAngle) };
                    return {
                        x: center.x + leftN.x * radialSign * safeRadius,
                        z: center.z + leftN.z * radialSign * safeRadius,
                    };
                };

                return new CurvedRoadPrimitive({
                    parent: scene3D.scene,
                    transient: false,
                    entry: pointAt(0),
                    mid: pointAt(0.5),
                    exit: pointAt(1),
                    roadType: RoadType.get(params.roadType),
                });
            };

            const arc1 = createArcPrimitive({
                start: { x: 0, z: 0, angle: 0 },
                radius: 10,
                sweepAngle: -Math.PI / 2,
                roadType: road1,
            });



            const arc2 = createArcPrimitive({
                start: { x: 21, z: 8, angle: 0 },
                radius: 10,
                sweepAngle: Math.PI / 2,
                roadType: road1,
            });

            const arc3 = createArcPrimitive({
                start: { x: 1, z: 34, angle: 0 },
                radius: 0.01,
                sweepAngle: Math.PI,
                roadType: road2,
            });

            void arc1, arc2, arc3;

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


