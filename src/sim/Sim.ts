import { SimCars } from "./SimCars";
import { SimTiles } from "./SimTiles";

export class Sim {
    readonly simTiles = new SimTiles(this);
    readonly simCars = new SimCars(this);
}
