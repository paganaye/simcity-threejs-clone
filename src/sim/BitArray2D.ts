export interface IBitArray2D {
    get(x: number, y: number): boolean;
    set(x: number, y: number, b: boolean): void;
    width: number;
    height: number;
}

export class BitArray2D implements IBitArray2D {
    readonly width: number;
    readonly height: number;
    private readonly data: Uint8Array;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        const size = Math.ceil(width * height / 8);
        this.data = new Uint8Array(size);
    }

    #getIndex(x: number, y: number): number {
        return y * this.width + x;
    }

    #checkBounds(x: number, y: number): void {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            throw new RangeError(`Out of bounds: (${x}, ${y})`);
        }
    }

    get(x: number, y: number): boolean {
        this.#checkBounds(x, y);
        const index = this.#getIndex(x, y);
        const byte = this.data[index >> 3];
        return ((byte >> (index & 7)) & 1) !== 0;
    }

    set(x: number, y: number, value: boolean): void {
        this.#checkBounds(x, y);
        const index = this.#getIndex(x, y);
        const byteIndex = index >> 3;
        const bit = 1 << (index & 7);
        if (value) {
            this.data[byteIndex] |= bit;
        } else {
            this.data[byteIndex] &= ~bit;
        }
    }

}

