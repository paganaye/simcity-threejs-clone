import { ModelId } from "../common/ModelIds";
import { Sim } from "./Sim";

export class SimBuildings {
    buildings: SimBuilding[] = [];
    buildingChanged = new Map<SimBuilding, IBuildingChangedWithId>();

    constructor(readonly simCity: Sim) { }

    feedRandom(_buildingCount: number) {
        // let newBuildings = [];
        // for (let i = 0; i < buildingCount; i++) {
        //     // let building = new SimBuilding(this.simCity, i, random(buildings))
        //     // newBuildings.push(building);
        //     // building.setBuildingChange(
        //     //     {
        //     //         path: this.#randomPath()
        //     //     }
        //     // )
        // }
        // this.buildings = newBuildings;

    }


    getBuildingChanged(): IBuildingChangedWithId[] {
        let result = new Array(...this.buildingChanged.values())
        return result;
    }

    getBuilding(x: number): SimBuilding {
        return this.buildings[x];
    }

}

export class SimBuilding {
    constructor(readonly city: Sim, readonly id: number, readonly model: ModelId) {

    }

    getBuildingChange() {
        return this.city.simBuildings.buildingChanged.get(this);
    }

    setBuildingChange(buildingChanged: IBuildingChanged) {
        (buildingChanged as IBuildingChangedWithId).id = this.id;
        let path = buildingChanged.path;
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
            buildingChanged.path = newPath;
        }

        this.city.simBuildings.buildingChanged.set(this, buildingChanged as IBuildingChangedWithId);
    }
}

export interface IBuildingInfo {
    id: number,
    model: ModelId,
    path: IBuildingPath[],
    motion: 'forward' | 'loop';
    startTime?: number;
}


export type IBuildingChanged = {
    model?: ModelId,
    path?: Partial<IBuildingPath>[],
    motion?: IBuildingInfo['motion']
    startTime?: number;
}
export type IBuildingChangedWithId = { id: number } & IBuildingChanged

export interface IBuildingPath {
    x: number;
    z: number;
    speed?: number;
}
