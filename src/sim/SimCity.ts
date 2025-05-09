import { SimCars } from "./SimCars";
import { SimTiles } from "./SimTiles";

export class SimCity {
    readonly simTiles = new SimTiles(this);
    readonly simCars = new SimCars(this);
}
