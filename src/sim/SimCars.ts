import { CAR_MODEL_IDS, ModelId } from "../common/ModelIds";
import { appConstants } from "../AppConstants";
import { Sim } from "./Sim";
import { random } from "./Rng"

export class SimCars {
    cars: SimCar[] = [];
    carChanged = new Map<SimCar, ICarChangedWithId>();

    constructor(readonly simCity: Sim) { }

    feedRandom(carCount: number) {
        let newCars = [];
        for (let i = 0; i < carCount; i++) {
            let car = new SimCar(this.simCity, i, random(CAR_MODEL_IDS as any))
            newCars.push(car);
            car.setCarChange(
                {
                    path: this.#randomPath()
                }
            )
        }
        this.cars = newCars;

    }

    #randomPath(): ICarPath[] {
        const size = appConstants.defaultCitySize;
        const speed = appConstants.STRAIGHT_SPEED;

        const x0 = random(size);
        const z0 = random(size);

        const x1 = Math.min(size - 1, x0 + 1);
        const z1 = Math.min(size - 1, z0 + 1);
        const x2 = Math.max(0, x0 - 1);

        // Temporary non-tile loop path while the continuous world model is rebuilt.
        return [
            { x: x0, z: z0, speed },
            { x: x1, z: z0, speed },
            { x: x1, z: z1, speed },
            { x: x0, z: z1, speed },
            { x: x2, z: z0, speed },
            { x: x0, z: z0, speed }
        ];
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
    constructor(readonly city: Sim, readonly id: number, readonly model: ModelId) { }

    getCarChange() {
        return this.city.simCars.carChanged.get(this);
    }

    setCarChange(carChanged: ICarChanged) {
        (carChanged as ICarChangedWithId).id = this.id;
        let path = carChanged.path;
        if (path) {
            let newPath = path.map(p => ({ x: p.x, z: p.z, speed: p.speed }))
                .filter((p, i, arr) => {
                    if (i === 0) return true;
                    const prev = arr[i - 1];
                    return p.x !== prev.x || p.z !== prev.z || p.speed !== prev.speed;
                });

            if (newPath.length > 1) {
                const first = newPath[0];
                const last = newPath.at(-1)!;
                if (first.x === last.x && first.z === last.z && first.speed === last.speed) {
                    newPath.pop();
                }
            }
            carChanged.path = newPath;
        }

        this.city.simCars.carChanged.set(this, carChanged as ICarChangedWithId);
    }
}

export interface ICarInfo {
    id: number,
    model: ModelId,
    path: ICarPath[],
    motion: 'forward' | 'loop';
    startTime?: number;
}


export type ICarChanged = {
    model?: ModelId,
    path?: Partial<ICarPath>[],
    motion?: ICarInfo['motion']
    startTime?: number;
}
export type ICarChangedWithId = { id: number } & ICarChanged

export interface ICarPath {
    x: number;
    z: number;
    speed?: number;
}
