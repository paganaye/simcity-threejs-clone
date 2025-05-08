
export class SimBridge {
    worker: Worker;
    resolve!: (value: any) => void;
    reject!: (value: any) => void;

    constructor() {
        this.worker = new Worker(new URL("../sim/SimWorker.ts", import.meta.url), { type: "module" });
        this.worker.onmessage = (event) => {
            switch (event.data.command) {
                case 'init':
                    // this.world = event.data.payload.world;
                    // this.people.length = 0;
                    // this.people.push(...event.data.payload.people.map((p: any) => new AnimatedPerson(p)));
                    this.resolve(undefined);
                    break;
                default:
                    console.log(event.data);
                    break;
            }
        };
        this.worker.onerror = (err) => {
            console.error(err);
            return this.reject(err);
        }
    }

    async init() {
        return new Promise<void>((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            this.worker.postMessage({ command: "init", payload: {} });
        });
    }



}