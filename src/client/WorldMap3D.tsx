import * as THREE from 'three';
import {
    commercialBuildings,
    industrialBuildings,
    residentialBuildings,
    type IFastMesh,
    type ModelName,
    type IModelFootprint,
} from './AssetManager';
import { GameScene3D } from './GameScene3D';
import { appConstants } from '../AppConstants';
import {
    type Vec2,
    getPolygonAabb,
    polygonInsideBounds,
    rotateAndTranslatePolygon,
} from '../utils/geometry';
import { IFloorSize } from './GameUIComponent';

export type PlacedFootprint = {
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

interface BuildingMetadata {
    buildingId: string;
}

export class WorldMap3D {
    readonly buildingModels: ModelName[] = [
        ...residentialBuildings,
        ...commercialBuildings,
        ...industrialBuildings
    ];
    readonly buildings: IFastMesh[] = [];
    readonly placedByInstance = new Map<string, PlacedBuilding>();
    private readonly buildingMetadata = new Map<string, BuildingMetadata>();
    private nextBuildingId = 0;
    private readonly tempMatrix = new THREE.Matrix4();
    private readonly tempPosition = new THREE.Vector3();
    private readonly tempQuaternion = new THREE.Quaternion();
    private readonly tempScale = new THREE.Vector3(1, 1, 1);

    root = new THREE.Group();
    size: IFloorSize;
    constructor(readonly scene: GameScene3D) {
        this.size = scene.size;
    }

    init() {
        // Runtime content is created after world size is known.
    }



    clearCity() {
        for (const mesh of this.buildings) {
            this.scene.assetManager.removeFastMesh(mesh);
        }
        this.buildings.length = 0;
        this.placedByInstance.clear();
        this.buildingMetadata.clear();
    }

    drawFrame(_now: number) {
    }

    getBuildingId(mesh: THREE.InstancedMesh, instanceId: number): string | undefined {
        const key = this.instanceKey(mesh, instanceId);
        return this.buildingMetadata.get(key)?.buildingId;
    }

    createNewBuildingId(meshKey: string): string {
        const id = `B${this.nextBuildingId++}`;
        this.buildingMetadata.set(meshKey, { buildingId: id });
        return id;
    }

    setBuildingId(meshKey: string, id: string): void {
        this.buildingMetadata.set(meshKey, { buildingId: id });
        const match = id.match(/B(\d+)/);
        if (match) {
            const num = parseInt(match[1], 10) + 1;
            if (num > this.nextBuildingId) {
                this.nextBuildingId = num;
            }
        }
    }

    buildPlacementFootprint(
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
        let current = this.placedByInstance.get(selfKey);
        if (!current) {
            const legacyEntry = this.#findPlacedEntryByInstance(mesh, instanceId);
            if (legacyEntry) {
                current = legacyEntry[1];
                this.placedByInstance.delete(legacyEntry[0]);
                this.placedByInstance.set(selfKey, current);
            }
        }
        if (!current) return false;

        const modelName = mesh.userData?.modelName as ModelName | undefined;
        if (!modelName) return false;

        const modelFootprint = this.scene.assetManager.getModelFootprint(modelName);
        const moved = this.buildPlacementFootprint(x, z, yaw, modelFootprint);
        if (!moved) return false;
        if (!polygonInsideBounds(moved.polygon, 0, 0, this.size.x, this.size.z)) return false;

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

    instanceKey(mesh: THREE.InstancedMesh, instanceId: number): string {
        const modelName = mesh.userData?.modelName as string | undefined;
        return `${modelName ?? mesh.id}:${instanceId}`;
    }

    removeBuilding(mesh: THREE.InstancedMesh, instanceId: number): boolean {
        const key = this.instanceKey(mesh, instanceId);
        const index = this.buildings.findIndex((entry) => entry.parent.instancedMesh === mesh && entry.index === instanceId);
        if (index < 0) return false;

        this.scene.assetManager.removeFastMesh(this.buildings[index]);
        this.buildings.splice(index, 1);
        if (!this.placedByInstance.delete(key)) {
            const legacyEntry = this.#findPlacedEntryByInstance(mesh, instanceId);
            if (legacyEntry) {
                this.placedByInstance.delete(legacyEntry[0]);
            }
        }
        this.buildingMetadata.delete(key);
        return true;
    }

    #findPlacedEntryByInstance(mesh: THREE.InstancedMesh, instanceId: number): [string, PlacedBuilding] | undefined {
        for (const entry of this.placedByInstance.entries()) {
            if (entry[1].mesh === mesh && entry[1].instanceId === instanceId) {
                return entry;
            }
        }
        return undefined;
    }

}

