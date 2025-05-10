export class LRU<TKey, TContent> {
    private cache: Map<TKey, TContent>;
    private maxSize: number;

    constructor(options: { max: number }) {
        this.cache = new Map();
        this.maxSize = options.max;
    }

    get(key: TKey): TContent | undefined {
        if (!this.cache.has(key)) {
            return undefined;
        }
        const value = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key: TKey, value: TContent): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }

    has(key: TKey): boolean {
        return this.cache.has(key);
    }

    delete(key: TKey): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }
}