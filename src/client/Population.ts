import { Character } from "./Character";
import { QuadTree } from "../sim/QuadTree";
import type { IRectangle } from "../sim/IPoint";

export class Population {
    private readonly _characters: Character[] = [];
    mapWidth = 0;
    mapHeight = 0;
    quadTree?: QuadTree<Character>;

    get characters(): readonly Character[] {
        return this._characters;
    }

    newCharacter(): Character {
        const c = new Character(this);
        this._characters.push(c);
        return c;
    }

    setupQuadTree(mapWidth: number, mapHeight: number): void {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        const boundary: IRectangle = { x: 0, z: 0, width: mapWidth, height: mapHeight };
        this.quadTree = new QuadTree<Character>(boundary, 8);
        for (const c of this._characters) {
            this.quadTree.insert(c);
        }
    }

    clear(): void {
        this._characters.length = 0;
        this.quadTree = undefined;
    }
}
