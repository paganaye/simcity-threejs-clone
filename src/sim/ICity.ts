import { ModelId } from "../common/ModelIds";

export interface ICity {
    width: number;
    height: number;
    cityName: string;
    tiles: ITile[]
}

export interface ITile {
    x: number,
    y: number;
    terrain: ModelId,
    terrainRotation?: number;
    building?: ModelId,
    buildingRotation?: number;
}
