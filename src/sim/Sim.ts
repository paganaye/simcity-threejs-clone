import { SimBuildings } from "./SimBuildings";
import { SimCars } from "./SimCars";
import { SimCharacters } from "./SimCharacter";

export class Sim {
    readonly simCars        = new SimCars(this);
    readonly simCharacters  = new SimCharacters(this);
    readonly simBuildings   = new SimBuildings(this);
}
