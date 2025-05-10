import { Sim } from "./Sim";
import { appConstants } from "../AppConstants";
import { ICarChangedWithId } from "./SimCars";
import { ITileChange } from "./SimTiles";

export function init(): ICityChanges {
    let simCity = new Sim()
    let size = appConstants.defaultCitySize;

    simCity.simTiles.setSize(size, size);
    simCity.simTiles.feedRandom();
    simCity.simTiles.computeModels();

    simCity.simCars.feedRandom(appConstants.DefaultCarCount);
    return {
        cityChanged: {
            name: 'my city',
            width: size,
            height: size,
            clear: true
        },
        tileChanged: simCity.simTiles.getTileChanged(),
        carChanged: simCity.simCars.getCarChanged()
    }
}

export interface ICityChanges {
    cityChanged?: ICityChanged;
    tileChanged?: ITileChange[];
    carChanged?: ICarChangedWithId[];
}
export interface ICityChanged {
    name: string;
    width: number;
    height: number;
    clear?: boolean
}


