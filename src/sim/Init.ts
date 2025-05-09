import { SimCity } from "./SimCity";
import { appConstants } from "../AppConstants";
import { ICarChangedWithId } from "./SimCars";
import { ITileChange } from "./SimTiles";

export function init(): ICityChanges {
    let simCity = new SimCity()
    let size = appConstants.defaultCitySize;

    simCity.simTiles.setSize(size, size);
    simCity.simTiles.feedRandom();

    simCity.simCars.feedRandom(appConstants.defaultCarCount);
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


