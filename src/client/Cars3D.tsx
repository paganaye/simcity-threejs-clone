import * as THREE from 'three';
import { Game3D } from './Game3D';
import { Car3D } from './Car3D';
import { ICarChangedWithId, ICarInfo, ICarPath } from '../sim/SimCars';
import { cars } from './AssetManager';
import { random } from '../sim/Rng';

export class Cars3D extends THREE.Group {
    #cars: Car3D[] = [];

    onCarsChanged(carChanges: ICarChangedWithId[]) {
        for (let car of carChanges) {
            this.onCarChanged(car);
        }
    }

    onCarChanged(car: ICarChangedWithId) {
        let car3D = this.#cars[car.id];
        if (!car3D) {
            let carInfo: ICarInfo = {
                id: car.id,
                model: car.model ?? random(cars),
                path: Cars3D.fixPath(car.path),
                motion: 'forward-and-backward'
            }
            car3D = new Car3D(this.game, carInfo);
            this.#cars[car.id] = car3D;
        }
    }

    constructor(readonly game: Game3D) {
        super();
    }

    drawFrame(delta: number) {
        for (let car of this.#cars) {

            car.drawFrame(this.game, delta)
        }
    }

    static fixPath(path?: Partial<ICarPath>[]): ICarPath[] {
        let speed = 1 / 5000;
        let x = 0;
        let y = 0;
        if (!path || path.length == 0) {
            return [{ speed, x, y }]
        } else {
            for (let p of path) {
                if (p.speed == undefined) p.speed = speed; else speed = p.speed;
                if (p.x == undefined) p.x = x; else x = p.x;
                if (p.y == undefined) p.y = y; else y = p.y;
            }
            return path as ICarPath[];
        }
    }
}