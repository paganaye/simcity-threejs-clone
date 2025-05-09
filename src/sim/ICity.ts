import { ModelName } from "../client/AssetManager.js";

export interface ICity {
    width: number;
    height: number;
    cityName: string;
    tiles: ITile[]
}

export interface ITile {
    x: number,
    y: number;
    terrain: ModelName,
    terrainRotation?: number;
    building?: ModelName,
    buildingRotation?: number;
}
