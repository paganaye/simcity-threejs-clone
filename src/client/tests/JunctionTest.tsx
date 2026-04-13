import { render } from 'solid-js/web';
import * as THREE from 'three';
import { GameScene3D } from '../GameScene3D';
import { GameUIComponent } from '../GameUIComponent';
import {
    computeMajorRoadSideCut,
    computeMinorRoadEndCut,
    computeMinorRoadLengthToMainEdge,
    getBoundaryLines,
    getMajorBoundarySelection,
    getMinorMajorIntersections,
    type IStraightRoadCutDef,
} from '../roads/JunctionCuts';
import { Page } from '../Page';
import { IRoadCuts } from '../textures/RoadTextureBuilder';
import type { IRoadType } from '../roads/IRoad';
import { StraightRoadPrimitive } from '../roads/StraightRoadPrimitive';

type IStraightRoadDef = IStraightRoadCutDef;
type IBoundaryKey = 'leftOuter' | 'roadLeft' | 'roadRight' | 'rightOuter';
type ILine2 = ReturnType<typeof getBoundaryLines>[IBoundaryKey];
type IVec2 = ILine2['origin'];

const SHOW_DEBUG_LINES = true;

function drawDebugLine(scene: THREE.Object3D, line: ILine2, fromT: number, toT: number, color: number, y = 0.06): void {
    const start = new THREE.Vector3(
        line.origin.x + line.direction.x * fromT,
        y,
        line.origin.z + line.direction.z * fromT,
    );
    const end = new THREE.Vector3(
        line.origin.x + line.direction.x * toT,
        y,
        line.origin.z + line.direction.z * toT,
    );
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color });
    scene.add(new THREE.Line(geometry, material));
}

function drawDebugPoint(scene: THREE.Object3D, point: IVec2, color: number, y = 0.08): void {
    const geometry = new THREE.SphereGeometry(0.18, 10, 10);
    const material = new THREE.MeshBasicMaterial({ color });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(point.x, y, point.z);
    scene.add(marker);
}

function pointOnLine(line: ILine2, t: number): IVec2 {
    return {
        x: line.origin.x + line.direction.x * t,
        z: line.origin.z + line.direction.z * t,
    };
}

function drawJunctionDebugLines(scene: THREE.Object3D, mainRoad: IStraightRoadDef, minorRoad: IStraightRoadDef): void {
    const major = getMajorBoundarySelection(mainRoad, minorRoad).lines;
    const minor = getBoundaryLines(minorRoad);
    const intersections = getMinorMajorIntersections(mainRoad, minorRoad, true);
    const rawIntersections = getMinorMajorIntersections(mainRoad, minorRoad, false);
    const before = -5;
    const mainAfter = mainRoad.length + 5;
    const minorAfter = minorRoad.length + 5;

    drawDebugLine(scene, major.outer, before, mainAfter, 0xff4444);
    drawDebugLine(scene, major.road, before, mainAfter, 0xffaa44);

    drawDebugLine(scene, minor.leftOuter, before, minorAfter, 0x44ff44);
    drawDebugLine(scene, minor.roadLeft, before, minorAfter, 0x44aaff);
    drawDebugLine(scene, minor.roadRight, before, minorAfter, 0x4466ff);
    drawDebugLine(scene, minor.rightOuter, before, minorAfter, 0x8844ff);

    const minorKeys: IBoundaryKey[] = ['leftOuter', 'roadLeft', 'roadRight', 'rightOuter'];
    for (const minorKey of minorKeys) {
        const rawOuter = rawIntersections.outer[minorKey];
        if (rawOuter !== null && Number.isFinite(rawOuter) && rawOuter >= -5 && rawOuter <= minorRoad.length + 10) {
            drawDebugPoint(scene, pointOnLine(minor[minorKey], rawOuter), 0xff00ff, 0.07);
        }

        const rawRoad = rawIntersections.road[minorKey];
        if (rawRoad !== null && Number.isFinite(rawRoad) && rawRoad >= -5 && rawRoad <= minorRoad.length + 10) {
            drawDebugPoint(scene, pointOnLine(minor[minorKey], rawRoad), 0x00ffff, 0.07);
        }

        const tOuter = intersections.outer[minorKey];
        if (tOuter !== null && Number.isFinite(tOuter) && tOuter >= -5 && tOuter <= minorRoad.length + 5) {
            drawDebugPoint(scene, pointOnLine(minor[minorKey], tOuter), 0xff5555);
        }

        const tRoad = intersections.road[minorKey];
        if (tRoad !== null && Number.isFinite(tRoad) && tRoad >= -5 && tRoad <= minorRoad.length + 5) {
            drawDebugPoint(scene, pointOnLine(minor[minorKey], tRoad), 0xffcc66);
        }
    }
}

export default class JunctionTest extends Page {
    scene3DInstance: GameScene3D | undefined;

    async run() {
        const mapSize = { x: 40, z: 40 };
        const scene3D = new GameScene3D(mapSize);
        this.scene3DInstance = scene3D;

        const handleUILoaded = async (): Promise<void> => {
            await scene3D.init(this);

            const roadType: IRoadType = {
                roadColor: 'old',
                lanes: 2,
                rightKerb: 'line',
                rightSidewalk: 'grass',
                laneWidth: 'normal',
                leftKerb: 'line',
                leftSidewalk: 'small',
            };

            const road1: IStraightRoadDef = {
                start: { x: 0, y: 0, z: 10, angle: 0 },
                length: 39,
                style: roadType,
            };

            const road2Base: IStraightRoadDef = {
                start: { x: 10, y: 0, z: 30, angle: Math.PI / 4 },
                length: 23,
                style: roadType,
            };

            const road2: IStraightRoadDef = {
                ...road2Base,
                length: computeMinorRoadLengthToMainEdge(road1, road2Base),
            };


            const road3Base: IStraightRoadDef = {
                start: { x: 10, y: 0, z: 0, angle: -Math.PI / 4 },
                length: 23,
                style: roadType,
            };

            const road3: IStraightRoadDef = {
                ...road3Base,
                length: computeMinorRoadLengthToMainEdge(road1, road3Base),
            };

            const road2Cuts = computeMinorRoadEndCut(road1, road2);

            if (SHOW_DEBUG_LINES) {
                drawJunctionDebugLines(scene3D.scene, road1, road2);
            }


            const road3Cuts = computeMinorRoadEndCut(road1, road3);

            const road1Cuts: IRoadCuts = {};
            computeMajorRoadSideCut(road1, road2, road1Cuts);
            computeMajorRoadSideCut(road1, road3, road1Cuts);

            new StraightRoadPrimitive({
                parent: scene3D.scene,
                transient: false,
                start: road1.start,
                end: { x: road1.start.x + Math.cos(road1.start.angle) * road1.length, z: road1.start.z - Math.sin(road1.start.angle) * road1.length },
                roadType: road1.style,
                cuts: road1Cuts,
            });

            new StraightRoadPrimitive({
                parent: scene3D.scene,
                transient: false,
                start: road2.start,
                end: { x: road2.start.x + Math.cos(road2.start.angle) * road2.length, z: road2.start.z - Math.sin(road2.start.angle) * road2.length },
                roadType: road2.style,
                cuts: { endCut: road2Cuts },
            });

            new StraightRoadPrimitive({
                parent: scene3D.scene,
                transient: false,
                start: road3.start,
                end: { x: road3.start.x + Math.cos(road3.start.angle) * road3.length, z: road3.start.z - Math.sin(road3.start.angle) * road3.length },
                roadType: road3.style,
                cuts: { endCut: road3Cuts },
            });


            scene3D.isLoading.set(false);
            this.setCameraView(20, 40, 40, 20, 0, 20);
        };

        render(() => <GameUIComponent page={this}
            scene3D={scene3D}
            mapSize={mapSize} onUILoaded={handleUILoaded} />, this.appContainer);
    }
}


