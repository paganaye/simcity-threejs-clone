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

export class WorldMap3D {
    readonly buildingModels: ModelName[] = [
        ...residentialBuildings,
        ...commercialBuildings,
        ...industrialBuildings
    ];
    readonly buildings: IFastMesh[] = [];
    readonly placedByInstance = new Map<string, PlacedBuilding>();
    private readonly tempMatrix = new THREE.Matrix4();
    private readonly tempPosition = new THREE.Vector3();
    private readonly tempQuaternion = new THREE.Quaternion();
    private readonly tempScale = new THREE.Vector3(1, 1, 1);

    root = new THREE.Group();
    width = 0;
    height = 0;

    constructor(readonly scene: GameScene3D) {
    }

    init() {
        // Runtime content is created after world size is known.
    }

    setSize(width: number, height: number) {
        if (width !== this.width || height !== this.height) {
            this.width = width;
            this.height = height;
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

