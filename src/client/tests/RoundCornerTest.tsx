import { render } from 'solid-js/web';
import * as THREE from 'three';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import { Page } from '../Page';
import type { IRoadType } from '../roads/IRoad';
//import type { RoadPrimitive } from '../roads/RoadPrimitive';
import { StraightRoadPrimitive } from '../roads/StraightRoadPrimitive';
import { RoadJoin } from '../roads/RoadJoin';
import type { PrimitiveEndPoint } from '../roads/RoadPrimitive';

export default class RoundCornerTest extends Page {
    scene3DInstance: GameScene3D | undefined;
    private minutePrimitive?: StraightRoadPrimitive;
    private secondPrimitive?: StraightRoadPrimitive;
    private requestedPrevRoadLine?: THREE.Line;
    private requestedNextRoadLine?: THREE.Line;
    //    private joinPrimitive?: RoadPrimitive;

    async run() {
        const mapSize = { x: 48, z: 48 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;


        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);

            const roadType: IRoadType = {
                roadColor: 'old',
                lanes: 1,
                rightKerb: 'line',
                rightSidewalk: 'grass',
                laneWidth: 'normal',
                leftKerb: 'line',
                leftSidewalk: 'small',
            };

            const centerX = 24;
            const centerZ = 24;
            this.minutePrimitive = new StraightRoadPrimitive({
                parent: scene3D.scene,
                transient: false,
                start: { x: centerX, z: centerZ },
                end: { x: centerX + 30, z: centerZ },
                roadType: roadType,
            });
            this.secondPrimitive = new StraightRoadPrimitive({
                parent: scene3D.scene,
                transient: false,
                start: { x: centerX, z: centerZ - 40 },
                end: { x: centerX, z: centerZ },
                roadType: roadType,
            });

            this.requestedPrevRoadLine = this.#createDebugLine(scene3D.scene, 0xff4444);
            this.requestedNextRoadLine = this.#createDebugLine(scene3D.scene, 0x44aaff);

            RoadJoin.joinRoads(scene3D.scene, this.secondPrimitive.exit, this.minutePrimitive.entry, roadType);
            console.log('[CurvedRoadTest] Two road primitives rotate like clock hands.');

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

        if (this.minutePrimitive && this.secondPrimitive && this.scene3DInstance) {
            elapsed /= 20; // slow down a bit
            const minuteAngle = elapsed * 0.4;
            const secondAngle = elapsed * 4.6;
            this.#rotatePrimitiveFromStart(this.minutePrimitive, centerX, centerZ, 30, minuteAngle);
            this.#rotatePrimitiveToEnd(this.secondPrimitive, centerX, centerZ, 40, secondAngle);
            this.#updateRequestedDebugLine(this.requestedPrevRoadLine, this.secondPrimitive.exit, 10);
            this.#updateRequestedDebugLine(this.requestedNextRoadLine, this.minutePrimitive.entry, 10);
        }

        this.scene3DInstance?.drawFrame(elapsed);
    }


    #rotatePrimitiveFromStart(primitive: StraightRoadPrimitive, centerX: number, centerZ: number, length: number, angle: number): void {
        primitive.move({ x: centerX, z: centerZ }, {
            x: centerX - Math.cos(angle) * length,
            z: centerZ + Math.sin(angle) * length,
        });
    }

    #rotatePrimitiveToEnd(primitive: StraightRoadPrimitive, centerX: number, centerZ: number, length: number, angle: number): void {
        primitive.move({
            x: centerX - Math.cos(angle) * length,
            z: centerZ + Math.sin(angle) * length,
        }, { x: centerX, z: centerZ });
    }

    #createDebugLine(scene: THREE.Object3D, color: number): THREE.Line {
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.2, 0),
            new THREE.Vector3(0, 0.2, 0),
        ]);
        const material = new THREE.LineBasicMaterial({ color });
        const line = new THREE.Line(geometry, material);
        scene.add(line);
        return line;
    }

    #updateRequestedDebugLine(line: THREE.Line | undefined, endpoint: PrimitiveEndPoint, length: number): void {
        if (!line) return;
        const dx = endpoint.primitive.exit.x - endpoint.primitive.entry.x;
        const dz = endpoint.primitive.exit.z - endpoint.primitive.entry.z;
        const vectorLength = Math.hypot(dx, dz);
        if (!Number.isFinite(vectorLength) || vectorLength <= 1e-6) return;
        const dirX = endpoint.side === 'entry' ? dx / vectorLength : -dx / vectorLength;
        const dirZ = endpoint.side === 'entry' ? dz / vectorLength : -dz / vectorLength;

        const points = [
            new THREE.Vector3(endpoint.x, 0.2, endpoint.z),
            new THREE.Vector3(endpoint.x + dirX * length, 0.2, endpoint.z + dirZ * length),
        ];
        line.geometry.setFromPoints(points);
    }




}


