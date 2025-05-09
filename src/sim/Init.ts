import { ModelName, residentialBuildings, roads } from "../client/AssetManager";
import { SimCity } from "./SimCity";
import { random } from "./Rng";
import { appConstants } from "../AppConstants";

export function init(): ICityChanges {
    let city = new SimCity()
    let size = appConstants.defaultCitySize;

    city.setSize(size, size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let floor: ModelName = (random(2) == 0 ? random(roads) : 'grass');
            let building = random(residentialBuildings);
            city.getTile(x, y).setFloor(floor, random(4) * 90)
            city.getTile(x, y).setBuilding(building, random(4) * 90)
        }
    }
    return {
        cityChanged: {
            name: 'my city',
            width: size,
            height: size,
            clear: true
        },
        tileChanged: city.getTileChanged()
    }
}

export interface ICityChanges {
    cityChanged?: ICityChanged;
    tileChanged?: ITileChange[];
}
export interface ICityChanged {
    name: string;
    width: number;
    height: number;
    clear?: boolean
}

export interface IPos {
    x: number;
    y: number;
}

export interface ITile {
    floor: ModelName;
    orientation: number;
    building?: ModelName | null;
    buildingOrientation?: number;
}

export type ITileChange = Partial<ITile> & IPos;
