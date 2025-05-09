import { cars, ModelName } from "../client/AssetManager";
import { SimCity } from "./SimCity";
import { random } from "./Rng"

export class SimCars {
    cars: SimCar[] = [];
    carChanged = new Map<SimCar, ICarChangedWithId>();

    constructor(readonly simCity: SimCity) { }

    feedRandom(carCount: number) {
        let newCars = [];
        for (let i = 0; i < carCount; i++) {
            let car = new SimCar(this.simCity, i, random(cars))
            newCars.push(car);
            let x0 = random(this.simCity.simTiles.width - 1)
            let y0 = random(this.simCity.simTiles.height - 1)
            let x1 = x0 + 1;
            let y1 = y0 + 1;
            car.setCarChange(
                {
                    path: [
                        { x: x0, y: y0 },
                        { x: x1, y: y0 },
                        { x: x1, y: y1 },
                        { x: x0, y: y1 }
                    ]
                }
            )
        }
        this.cars = newCars;

    }


    getCarChanged(): ICarChangedWithId[] {
        let result = new Array(...this.carChanged.values())
        return result;
    }

    getCar(x: number): SimCar {
        return this.cars[x];
    }

}

export class SimCar {
    constructor(readonly city: SimCity, readonly id: number, readonly model: ModelName) { }

    getCarChange() {
        return this.city.simCars.carChanged.get(this);
    }

    setCarChange(carChanged: ICarChanged) {
        (carChanged as ICarChangedWithId).id = this.id;
        this.city.simCars.carChanged.set(this, carChanged as ICarChangedWithId);
    }
}

export interface ICarInfo {
    id: number,
    model: ModelName,
    path: ICarPath[],
    motion: 'forward' | 'loop' | 'forward-and-backward'
    startTime?: number;
}


export type ICarChanged = {
    model?: ModelName,
    path?: Partial<ICarPath>[],
    motion?: ICarInfo['motion']
    startTime?: number;
}
export type ICarChangedWithId = { id: number } & ICarChanged

export interface ICarPath {
    x: number;
    y: number;
    speed: number;
}
