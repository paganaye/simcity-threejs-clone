import { Sim } from "./Sim";
import { appConstants } from "../AppConstants";
import { ICarChangedWithId } from "./SimCars";
import { ICharacterChanged, IHouseholdChanged } from "./SimCharacter";
import type { ICityDelta, ISimulationDelta } from "../common/SimulationDelta";

export function init(): ISimulationDelta {
    let simCity = new Sim()
    let size = appConstants.defaultCitySize;

    simCity.simCars.feedRandom(appConstants.DefaultCarCount);
    simCity.simCharacters.feedRandom(10);

    return {
        cityChanged: {
            name: 'my city',
            width: size,
            height: size,
            clear: true
        },
        carChanged: simCity.simCars.getCarChanged(),
        characterChanged: simCity.simCharacters.getCharacterChanged(),
        householdChanged: simCity.simCharacters.getHouseholdChanged(),
    }
}

export interface ICityChanges {
    cityChanged?: ICityChanged;
    carChanged?: ICarChangedWithId[];
    characterChanged?: ICharacterChanged[];
    householdChanged?: IHouseholdChanged[];
}

export type ICityChanged = ICityDelta;


