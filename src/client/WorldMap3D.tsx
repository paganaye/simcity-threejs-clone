import * as THREE from 'three';
import {
    commercialBuildings,
    industrialBuildings,
    residentialBuildings,
    type IFastMesh,
    type ModelName,
    type IModelFootprint,
} from './AssetManager';
import { Scene3D } from './Scene3D';
import { appConstants } from '../AppConstants';
import {
    type Vec2,
    aabbOverlap,
    getPolygonAabb,
    polygonInsideBounds,
    polygonsIntersectSAT,
    rotateAndTranslatePolygon,
} from '../utils/geometry';

type PlacedFootprint = {
    center: Vec2;
    polygon: Vec2[];
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
};

type PlacedBuilding = PlacedFootprint & {
    mesh: THREE.InstancedMesh;
    instanceId: number;
};

export class WorldMap3D {
    private readonly buildingModels: ModelName[] = [
        ...residentialBuildings,
        ...commercialBuildings,
        ...industrialBuildings
    ];
    private readonly buildings: IFastMesh[] = [];
    private readonly placedByInstance = new Map<string, PlacedBuilding>();
    private readonly tempMatrix = new THREE.Matrix4();
    private readonly tempPosition = new THREE.Vector3();
    private readonly tempQuaternion = new THREE.Quaternion();
    private readonly tempScale = new THREE.Vector3(1, 1, 1);

    root = new THREE.Group();
    width = 0;
    height = 0;

    constructor(readonly scene: Scene3D) {
    }

    init() {
        // Runtime content is created after world size is known.
    }

    setSize(width: number, height: number) {
        if (width !== this.width || height !== this.height) {
            this.width = width;
            this.height = height;
            this.rebuild();
        }
    }

    clearCity() {
        for (const mesh of this.buildings) {
            this.scene.assetManager.removeFastMesh(mesh);
        }
        this.buildings.length = 0;
        this.placedByInstance.clear();
    }

    drawFrame(_now: number) {
    }

    private rebuild() {
        this.root.clear();
        this.clearCity();
        this.placeRandomBuildings();
        this.scene.onMapResized();
    }

    private placeRandomBuildings() {
        if (this.width <= 0 || this.height <= 0) return;

        const totalCells = this.width / appConstants.BuildingsScale * this.height / appConstants.BuildingsScale;
        const targetCount = Math.max(20, Math.floor(totalCells * 0.06));
        const directionCount = 16;
        const angleStep = (Math.PI * 2) / directionCount;
        const placed: PlacedFootprint[] = [];
        const maxLength = appConstants.BuildingsMaxLength;
        const cellSize = Math.max(1, maxLength);
        const buckets = new Map<string, number[]>();

        const maxAttempts = targetCount * 40;
        let attempts = 0;

        while (placed.length < targetCount && attempts < maxAttempts) {
            attempts++;
            const x = (Math.random() * this.width) | 0;
            const z = (Math.random() * this.height) | 0;
            const model = this.buildingModels[(Math.random() * this.buildingModels.length) | 0];
            const orientationIndex = (Math.random() * directionCount) | 0;
            const orientation = orientationIndex * angleStep;

            const modelFootprint = this.scene.assetManager.getModelFootprint(model);
            const candidate = this.buildPlacementFootprint(x, z, orientation, modelFootprint);
            if (!candidate) continue;
            if (!polygonInsideBounds(candidate.polygon, 0, 0, this.width, this.height)) continue;

            const bx = Math.floor(candidate.center.x / cellSize);
            const bz = Math.floor(candidate.center.z / cellSize);

            let blocked = false;
            for (let dzCell = -1; dzCell <= 1 && !blocked; dzCell++) {
                for (let dxCell = -1; dxCell <= 1 && !blocked; dxCell++) {
                    const neighbor = buckets.get(`${bx + dxCell}:${bz + dzCell}`);
                    if (!neighbor) continue;

                    for (const idx of neighbor) {
                        const other = placed[idx];
                        if (Math.abs(other.center.x - candidate.center.x) > maxLength) continue;
                        if (Math.abs(other.center.z - candidate.center.z) > maxLength) continue;
                        if (!aabbOverlap(candidate, other)) continue;
                        if (polygonsIntersectSAT(candidate.polygon, other.polygon)) {
                            blocked = true;
                            break;
                        }
                    }
                }
            }

            if (blocked) continue;

            const mesh = this.scene.assetManager.addFastMesh(model, x, 0.0, z, orientation);
            this.buildings.push(mesh);
            this.placedByInstance.set(this.instanceKey(mesh.parent.instancedMesh, mesh.index), {
                ...candidate,
                mesh: mesh.parent.instancedMesh,
                instanceId: mesh.index,
            });

            const newIndex = placed.length;
            placed.push(candidate);
            const key = `${bx}:${bz}`;
            const list = buckets.get(key);
            if (list) list.push(newIndex);
            else buckets.set(key, [newIndex]);
        }
    }

    private buildPlacementFootprint(
        x: number,
        z: number,
        orientation: number,
        modelFootprint?: IModelFootprint
    ): PlacedFootprint | null {
        const localPoly = modelFootprint?.polygon;
        const polygon = (localPoly && localPoly.length >= 3)
            ? rotateAndTranslatePolygon(localPoly, x, z, orientation)
            : rotateAndTranslatePolygon(this.fallbackSquare(), x, z, orientation);

        if (polygon.length < 3) return null;
        const box = getPolygonAabb(polygon);

        return {
            center: { x, z },
            polygon,
            minX: box.minX,
            maxX: box.maxX,
            minZ: box.minZ,
            maxZ: box.maxZ,
        };
    }

    private fallbackSquare(): Vec2[] {
        const half = appConstants.BuildingsScale * 0.4;
        return [
            { x: -half, z: -half },
            { x: half, z: -half },
            { x: half, z: half },
            { x: -half, z: half },
        ];
    }

    getBuildingYaw(mesh: THREE.InstancedMesh, instanceId: number): number {
        mesh.getMatrixAt(instanceId, this.tempMatrix);
        this.tempMatrix.decompose(this.tempPosition, this.tempQuaternion, this.tempScale);
        const euler = new THREE.Euler().setFromQuaternion(this.tempQuaternion, 'YXZ');
        return euler.y;
    }

    tryUpdateBuildingTransform(mesh: THREE.InstancedMesh, instanceId: number, x: number, z: number, yaw: number): boolean {
        const selfKey = this.instanceKey(mesh, instanceId);
        const current = this.placedByInstance.get(selfKey);
        if (!current) return false;

        const modelName = mesh.userData?.modelName as ModelName | undefined;
        if (!modelName) return false;

        const modelFootprint = this.scene.assetManager.getModelFootprint(modelName);
        const moved = this.buildPlacementFootprint(x, z, yaw, modelFootprint);
        if (!moved) return false;
        if (!polygonInsideBounds(moved.polygon, 0, 0, this.width, this.height)) return false;

        // Overlap checks disabled for interactive transform.

        mesh.getMatrixAt(instanceId, this.tempMatrix);
        this.tempMatrix.decompose(this.tempPosition, this.tempQuaternion, this.tempScale);
        this.tempPosition.set(x, this.tempPosition.y, z);
        this.tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
        mesh.setMatrixAt(instanceId, this.tempMatrix);
        mesh.instanceMatrix.needsUpdate = true;

        this.placedByInstance.set(selfKey, {
            ...moved,
            mesh,
            instanceId,
        });
        return true;
    }

    private instanceKey(mesh: THREE.InstancedMesh, instanceId: number): string {
        return `${mesh.id}:${instanceId}`;
    }

}