import { GameScene3D } from "./GameScene3D";
import type { ModelName } from "./AssetManager";
import type { Population } from "./Population";
import type { RoadType } from "./RoadBuilder";
import type { IRoad } from "./roads/IRoad";
import * as THREE from 'three';



export interface IStoreGameData<TGameData> {
    loadGameData(data: TGameData): void;
    saveGameData(target: TGameData): void;
}

export interface ISerializedBuilding {
    buildingId: string;
    modelName: ModelName;
    x: number;
    y: number;
    z: number;
    yaw: number;
}

export interface ISerializedRoad {
    startX: number;
    startZ: number;
    angle: number;
    length: number;
    roadType: RoadType;
    iRoad?: IRoad;
    endX?: number;
    endZ?: number;
    arcMidX?: number;
    arcMidZ?: number;
}

export interface ISerializedCharacter {
    characterId?: string;
    x: number;
    z: number;
    heading: number;
    speed: number;
    scale: number;
    isBlocked: boolean;
    waitDuration: number;
    target?: { x: number; z: number };
    homeId?: string;
    workId?: string;
}

export interface ISerializedCity {
    version: 1;
    mapSize: { x: number; z: number };
    buildings: ISerializedBuilding[];
    roads: ISerializedRoad[];
    characters: ISerializedCharacter[];
}

export class GameStorage {
    private static readonly STORAGE_PREFIX = 'simcity-debug-save:';
    private static readonly LAST_SAVE_NAME_KEY = 'simcity-debug-last-save-name';
    private readonly tempMatrix = new THREE.Matrix4();
    private readonly tempPosition = new THREE.Vector3();
    private readonly tempQuaternion = new THREE.Quaternion();
    private readonly tempScale = new THREE.Vector3();
    private readonly tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');

    constructor(
        readonly scene: GameScene3D,
        private readonly getPopulation: () => Population | undefined,
    ) {
        // if we stick to one game we might be able to do incremental saves
    }

    saveGame(name?: string): string {
        const saveName = this.#normalizeName(name);
        const payload = this.#captureCity();
        localStorage.setItem(this.#getStorageKey(saveName), JSON.stringify(payload));
        localStorage.setItem(GameStorage.LAST_SAVE_NAME_KEY, saveName);
        return saveName;
    }

    getDefaultName(): string {
        return 'city1';
    }

    listSaveNames(): string[] {
        const names: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(GameStorage.STORAGE_PREFIX)) continue;
            names.push(key.slice(GameStorage.STORAGE_PREFIX.length));
        }
        names.sort((a, b) => a.localeCompare(b));
        return names;
    }

    getLastSaveName(): string | undefined {
        const lastName = localStorage.getItem(GameStorage.LAST_SAVE_NAME_KEY)?.trim();
        if (!lastName) return undefined;
        const exists = localStorage.getItem(this.#getStorageKey(lastName)) != null;
        return exists ? lastName : undefined;
    }

    loadGame(name?: string): boolean {
        const saveName = this.#normalizeName(name);
        const input = localStorage.getItem(this.#getStorageKey(saveName));
        if (input) {
            try {
                const parsed = JSON.parse(input) as Partial<ISerializedCity>;
                if (!this.#isValidSave(parsed)) {
                    console.warn(`Save validation failed for "${saveName}":`, parsed);
                    return false;
                }
                this.#restoreCity(parsed);
                localStorage.setItem(GameStorage.LAST_SAVE_NAME_KEY, saveName);
                return true;
            } catch (e) {
                console.error(`Failed to load "${saveName}":`, e);
            }
        }
        return false;
    }

    #getStorageKey(name: string): string {
        return `${GameStorage.STORAGE_PREFIX}${name}`;
    }

    #normalizeName(name?: string): string {
        const trimmed = name?.trim();
        return trimmed && trimmed.length > 0 ? trimmed : this.getDefaultName();
    }

    #captureCity(): ISerializedCity {
        const buildings = this.scene.worldMap3D.buildings.map((entry) => {
            const mesh = entry.parent.instancedMesh;
            mesh.getMatrixAt(entry.index, this.tempMatrix);
            this.tempMatrix.decompose(this.tempPosition, this.tempQuaternion, this.tempScale);
            this.tempEuler.setFromQuaternion(this.tempQuaternion);
            const modelName = mesh.userData?.modelName as ModelName;
            const buildingId = this.scene.worldMap3D.getBuildingId(mesh, entry.index) ?? 'unknown';
            return {
                buildingId,
                modelName,
                x: this.tempPosition.x,
                y: this.tempPosition.y,
                z: this.tempPosition.z,
                yaw: this.tempEuler.y,
            };
        });

        const roads = this.scene.roadNetwork.segments.map((segment) => ({
            startX: segment.startX,
            startZ: segment.startZ,
            angle: segment.angle,
            length: segment.length,
            roadType: segment.roadType,
            iRoad: segment.getIRoad(),
            endX: segment.endX,
            endZ: segment.endZ,
            arcMidX: segment.arcMidX,
            arcMidZ: segment.arcMidZ,
        }));

        const population = this.getPopulation();
        const characters = (population?.characters ?? []).map((character) => ({
            characterId: character.characterId,
            x: character.x,
            z: character.z,
            heading: character.heading,
            speed: character.speed,
            scale: character.scale,
            isBlocked: character.isBlocked,
            waitDuration: character.waitDuration,
            target: character.target ? { x: character.target.x, z: character.target.z } : undefined,
            homeId: character.homeId,
            workId: character.workId,
        }));

        return {
            version: 1,
            mapSize: {
                x: this.scene.worldMap3D.size.x,
                z: this.scene.worldMap3D.size.z,
            },
            buildings,
            roads,
            characters,
        };
    }

    #restoreCity(save: ISerializedCity): void {
        const world = this.scene.worldMap3D;

        this.scene.clearSelection();
        world.clearCity();

        for (const existing of [...this.scene.roadNetwork.segments]) {
            this.scene.roadNetwork.removeSegment(existing);
        }

        for (const building of save.buildings) {
            try {
                const mesh = this.scene.assetManager.addFastMesh(
                    building.modelName,
                    building.x,
                    building.y,
                    building.z,
                    building.yaw,
                );
                world.buildings.push(mesh);

                const footprint = world.buildPlacementFootprint(
                    building.x,
                    building.z,
                    building.yaw,
                    this.scene.assetManager.getModelFootprint(building.modelName),
                );
                if (footprint) {
                    const key = world.instanceKey(mesh.parent.instancedMesh, mesh.index);
                    world.placedByInstance.set(key, {
                        ...footprint,
                        mesh: mesh.parent.instancedMesh,
                        instanceId: mesh.index,
                    });
                    world.setBuildingId(key, building.buildingId);
                }
            } catch (error) {
                console.warn(`Failed to load building ${building.buildingId} (${building.modelName}) at (${building.x}, ${building.z}):`, error);
            }

        }

        for (const road of save.roads) {
            const segment = this.scene.roadNetwork.addSegment(
                this.scene.scene,
                road.startX,
                road.startZ,
                road.angle,
                road.length,
                road.roadType,
            );
            if (road.iRoad) {
                segment.setIRoad(road.iRoad);
            }
            if (road.arcMidX !== undefined && road.arcMidZ !== undefined) {
                segment.setArc(road.arcMidX, road.arcMidZ, road.endX, road.endZ);
            }
        }

        const population = this.getPopulation();
        if (population) {
            population.dispose();
            population.init(save.mapSize.x, save.mapSize.z, { count: save.characters.length });
            for (let i = 0; i < save.characters.length; i++) {
                const source = save.characters[i];
                const character = population.characters[i];
                if (!character) continue;

                if (source.characterId) {
                    character.setCharacterId(source.characterId);
                }
                character.x = source.x;
                character.z = source.z;
                character.heading = source.heading;
                character.speed = source.speed;
                character.scale = source.scale;
                character.isBlocked = source.isBlocked;
                character.waitDuration = source.waitDuration;
                if (source.target) {
                    character.setTarget({ x: source.target.x, z: source.target.z });
                } else {
                    character.clearTarget();
                }
                character.homeId = source.homeId;
                character.workId = source.workId;
            }
        }
    }

    #isValidSave(value: Partial<ISerializedCity>): value is ISerializedCity {
        // Accept saves with or without explicit version field (backwards compatibility)
        const hasVersion = value.version === 1 || value.version === undefined;
        return hasVersion
            && !!value.mapSize
            && typeof value.mapSize.x === 'number'
            && typeof value.mapSize.z === 'number'
            && Array.isArray(value.buildings)
            && Array.isArray(value.roads)
            && Array.isArray(value.characters);
    }

}