import { GameScene } from "./GameScene";


interface IBuilding {
    x: number;
    y: number;
    terrain: string;
    type: string;
    data: any;
}

interface IGame {
    size: number;
    buildings: IBuilding[];
    simTime: number;
    simMoney: number;

}
export interface IStoreGameData<TGameData> {
    loadGameData(data: TGameData): void;
    saveGameData(target: TGameData): void;
}
export class GameStorage {
    constructor(readonly game: GameScene) {
        // if we stick to one game we might be able to do incremental saves
    }

    saveGame(name?: string) {
        let city = this.game.cityView;

        if (name == null) name = this.getDefaultName()
        let size = city.size;
        let buildings: IBuilding[] = [];
        let simTime = city.simTime;
        let simMoney = city.simMoney;
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                //let tile = city.getTile(x, y);
                // let { building, terrain } = tile;
                // if (tile && building) {
                //     let { x, y, type } = building;
                //     let data = {}
                //     building.saveGameData(data);
                //     buildings.push({
                //         terrain,
                //         x,
                //         y,
                //         type,
                //         data
                //     })

                // }
            }
        }
        let storageGame: IGame = {
            size,
            simTime,
            simMoney,
            buildings
        }
        let output = JSON.stringify(storageGame);
        localStorage.setItem(name, output);
    }

    getDefaultName(): string {
        let city = this.game.cityView;
        return city?.name || 'simcity';
    }

    loadGame(name?: string): boolean {
        let city = this.game.cityView;
        if (name == null) name = this.getDefaultName()
        let input = localStorage.getItem(name);
        if (input) {
            try {
                let storageGame = JSON.parse(input) as IGame;
                city.simTime = storageGame.simTime;
                city.simMoney = storageGame.simMoney;
                city.init(this.game) //, storageGame.size, name);
                
                return true;
            } catch (e) {
                console.error(e);
            }
        }
        return false;
    }

}