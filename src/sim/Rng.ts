
export class SeededRNG {
    private seed: number;

    constructor(seed?: number) {
        if (!seed) seed = 30_05_2007;
        this.seed = seed;
    }

    next(): number {
        this.seed ^= this.seed << 13;
        this.seed ^= this.seed >> 17;
        this.seed ^= this.seed << 5;
        return (this.seed >>> 0) / 0xFFFFFFFF;
    }
}

export function setRandomSeed(seed?: number) {
    rng = new SeededRNG(seed ?? Date.now());
    return rng;
}

let rng: SeededRNG;
setRandomSeed(30_05_2007);


export function random<T>(array: T[]): T;
export function random(max: number): number;
export function random<T>(arg: T[] | number): T | number {
    if (typeof arg === "number") {
        return Math.floor(rng.next() * arg);
    } else {
        let len = arg.length;
        if (len == 0) {
            throw Error('Cannot get a random element from an empty array.')
        }
        const index = random(len);
        return arg[index];
    }
}
export function randomOrNull<T>(arg: T[]): T | null {
    return arg.length == 0 ? null : random(arg);

}

export function randomBetween(min: number, max: number): number {
    return Math.floor(rng.next() * (max - min) + min);
}
