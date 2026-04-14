import { GameScene3D } from "./GameScene3D";
import type { ModelName } from "./AssetManager";
import type { Population } from "./characters/Population";
import type { IDualRoadType } from "./roads/IRoad";
import { RoadSegment } from "./roads/RoadSegment";
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
    iRoad?: IDualRoadType;
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

export interface ISerializedCamera {
    position: { x: number; y: number; z: number };
    target?: { x: number; y: number; z: number };
}

export interface ISerializedCity {
    version: 1;
    mapSize: { x: number; z: number };
    buildings: ISerializedBuilding[];
    roads: ISerializedRoad[];
    characters: ISerializedCharacter[];
    camera?: ISerializedCamera;
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

        const roads = this.#collectRoadSegments().map((segment) => ({
            startX: segment.startX,
            startZ: segment.startZ,
            angle: segment.angle,
            length: segment.length,
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

        const cameraTarget = this.scene.page?.cameraControls?.target;
        const camera = {
            position: {
                x: this.scene.camera.position.x,
                y: this.scene.camera.position.y,
                z: this.scene.camera.position.z,
            },
            target: cameraTarget
                ? { x: cameraTarget.x, y: cameraTarget.y, z: cameraTarget.z }
                : undefined,
        };

        return {
            version: 1,
            mapSize: {
                x: this.scene.worldMap3D.size.x,
                z: this.scene.worldMap3D.size.z,
            },
            buildings,
            roads,
            characters,
            camera,
        };
    }

    #restoreCity(save: ISerializedCity): void {
        const world = this.scene.worldMap3D;

        this.scene.clearSelection();
        world.clearCity();
        this.#clearRoadSegments();

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
            const segment = this.scene.roadNetwork.addSegment(new RoadSegment(
                this.scene.scene,
                { x: road.startX, z: road.startZ },
                {
                    x: road.startX + Math.cos(road.angle) * road.length,
                    z: road.startZ - Math.sin(road.angle) * road.length,
                },
                road.iRoad,
            ));
            if (
                road.arcMidX !== undefined
                && road.arcMidZ !== undefined
                && road.endX !== undefined
                && road.endZ !== undefined
            ) {
                segment.setArc({ x: road.arcMidX, z: road.arcMidZ }, { x: road.endX, z: road.endZ });
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

        if (save.camera?.position) {
            this.scene.camera.position.set(
                save.camera.position.x,
                save.camera.position.y,
                save.camera.position.z,
            );
            if (save.camera.target) {
                const controls = this.scene.page?.cameraControls;
                if (controls) {
                    controls.target.set(
                        save.camera.target.x,
                        save.camera.target.y,
                        save.camera.target.z,
                    );
                    // Keep controls' internal spherical state in sync with restored camera.
                    controls.updateSphericalFromCamera();
                    controls.update();
                } else {
                    this.scene.camera.lookAt(
                        save.camera.target.x,
                        save.camera.target.y,
                        save.camera.target.z,
                    );
                }
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

    #collectRoadSegments(): RoadSegment[] {
        const segments = new Set<RoadSegment>(this.scene.roadNetwork.segments);
        this.scene.scene.traverse((obj) => {
            const segment = obj.userData?.roadSegment as RoadSegment | undefined;
            if (segment) {
                segments.add(segment);
            }
        });
        return [...segments];
    }

    #clearRoadSegments(): void {
        const segments = this.#collectRoadSegments();
        this.scene.roadNetwork.segments.length = 0;
        for (const segment of segments) {
            segment.dispose();
        }
    }

}