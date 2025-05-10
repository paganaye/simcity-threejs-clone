import { Scene3D } from "./Scene3D";



export interface IStoreGameData<TGameData> {
    loadGameData(data: TGameData): void;
    saveGameData(target: TGameData): void;
}
export class GameStorage {
    constructor(readonly scene: Scene3D) {
        // if we stick to one game we might be able to do incremental saves
    }

    saveGame(name?: string) {
        //let city = this.game.cityView;

        if (name == null) name = this.getDefaultName()
        // let { width, height } = city;
        // let buildings: IBuilding[] = [];
        // let simTime = city.simTime;
        // let simMoney = city.simMoney;
        // for (let z = 0; z < height; z++) {
        //     for (let x = 0; x < width; x++) {
        //         //let tile = city.getTile(x, z);
        //         // let { building, terrain } = tile;
        //         // if (tile && building) {
        //         //     let { x, z, type } = building;
        //         //     let data = {}
        //         //     building.saveGameData(data);
        //         //     buildings.push({
        //         //         terrain,
        //         //         x,
        //         //         z,
        //         //         type,
        //         //         data
        //         //     })

        //         // }
        //     }
        // }
        // let storageGame: IGame = {
        //     width,
        //     height,
        //     simTime,
        //     simMoney,
        //     buildings
        // }
        //let output = JSON.stringify(storageGame);
        //localStorage.setItem(name, output);
    }

    getDefaultName(): string {
        return 'simcity';
    }

    loadGame(name?: string): boolean {
        //let city = this.game.cityView;
        if (name == null) name = this.getDefaultName()
        let input = localStorage.getItem(name);
        if (input) {
            try {
                // let storageGame = JSON.parse(input) as IGame;
                // city.simTime = storageGame.simTime;
                // city.simMoney = storageGame.simMoney;
                // city.init(this.game) //, storageGame.size, name);

                return true;
            } catch (e) {
                console.error(e);
            }
        }
        return false;
    }

}