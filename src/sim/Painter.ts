import { IBitArray2D } from "./BitArray2D";


export class Painter {
    get: (x: number, y: number) => boolean;
    set: (x: number, y: number, b: boolean) => void;
    width: number;
    height: number;

    constructor(readonly target: IBitArray2D) {
        this.get = target.get;
        this.set = target.set;
        this.width = target.width;
        this.height = target.height;
    }

    anyInRect(x: number, z: number, w: number, h: number): boolean {
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                if (this.get(x + i, z + j)) return true;
            }
        }
        return false;
    }

    setRect(x: number, z: number, w: number, h: number, value: boolean): void {
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                this.set(x + i, z + j, value);
            }
        }
    }

    clear() {
        for (let z = 0; z < this.height; z++) {
            for (let x = 0; x < this.width; x++) {
                this.set(x, z, false);
            }
        }
    }

}
