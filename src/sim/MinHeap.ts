export class MinHeap<T> {

    readonly heap: T[] = [];
    constructor(private scoreFn: (item: T) => number) { }

    push(item: T) {
        this.heap.push(item);
        this.bubbleUp(this.heap.length - 1);
    }

    pop(): T | undefined {
        if (this.heap.length === 0) return undefined;
        const top = this.heap[0];
        const bottom = this.heap.pop()!;
        if (this.heap.length > 0) {
            this.heap[0] = bottom;
            this.sinkDown(0);
        }
        return top;
    }

    peek() {
        return this.heap[0];
    }

    get size(): number {
        return this.heap.length;
    }

    private bubbleUp(n: number) {
        const element = this.heap[n];
        const score = this.scoreFn(element);
        while (n > 0) {
            const parentN = Math.floor((n + 1) / 2) - 1;
            const parent = this.heap[parentN];
            if (score >= this.scoreFn(parent)) break;
            this.heap[parentN] = element;
            this.heap[n] = parent;
            n = parentN;
        }
    }

    private sinkDown(n: number) {
        const length = this.heap.length;
        const element = this.heap[n];
        const elemScore = this.scoreFn(element);

        while (true) {
            let child2N = (n + 1) * 2;
            let child1N = child2N - 1;
            let swap: number | null = null;
            let child1Score: number;
            if (child1N < length) {
                const child1 = this.heap[child1N];
                child1Score = this.scoreFn(child1);
                if (child1Score < elemScore) {
                    swap = child1N;
                }
            }
            if (child2N < length) {
                const child2 = this.heap[child2N];
                const child2Score = this.scoreFn(child2);
                if (child2Score < (swap === null ? elemScore : child1Score!)) {
                    swap = child2N;
                }
            }
            if (swap === null) break;
            this.heap[n] = this.heap[swap];
            this.heap[swap] = element;
            n = swap;
        }
    }
}
