import { Sim } from "./Sim";
import { appConstants } from "../AppConstants";
import { ICarChangedWithId } from "./SimCars";

export function init(): ICityChanges {
    let simCity = new Sim()
    let size = appConstants.defaultCitySize;

    simCity.simCars.feedRandom(appConstants.DefaultCarCount);
    return {
        cityChanged: {
            name: 'my city',
            width: size,
            height: size,
            clear: true
        },
        carChanged: simCity.simCars.getCarChanged()
    }
}

export interface ICityChanges {
    cityChanged?: ICityChanged;
    carChanged?: ICarChangedWithId[];
}
export interface ICityChanged {
    name: string;
    width: number;
    height: number;
    clear?: boolean
}


