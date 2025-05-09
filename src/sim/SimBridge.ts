import { Game3D } from "../client/Game3D";
import { workerCommands, WorkerCommand, IWorkerResponse, IWorkerRequest } from "./SimWorker";

export class SimBridge {
    worker: Worker;
    pendingRequests: Record<number, { command: WorkerCommand, resolve: (value: any) => void, reject: (reason: any) => void }> = {};
    callNo: number = 0;

    constructor(readonly game3D: Game3D) {
        this.worker = new Worker(new URL("../sim/SimWorker.ts", import.meta.url), { type: "module" });

        this.worker.onmessage = (event) => {
            const response = event.data as IWorkerResponse;
            const pending = this.pendingRequests[response.id];
            if (!pending) return;

            delete this.pendingRequests[response.id];

            if (response.success) {
                pending.resolve(response.result);
            } else {
                pending.reject(new Error(response.error));
            }
        };

        this.worker.onerror = (event) => {
            console.error("Worker error:", event);
        };
    }

    call<K extends WorkerCommand>(
        command: K,
        ...args: Parameters<typeof workerCommands[K]>
    ): Promise<ReturnType<typeof workerCommands[K]>> {
        const id = ++this.callNo;
        return new Promise((resolve, reject) => {
            this.pendingRequests[id] = { command, resolve, reject };
            const request: IWorkerRequest = { id, command, args };
            this.worker.postMessage(request);
        });
    }

    createCaller(): {
        [K in WorkerCommand]: (...args: Parameters<typeof workerCommands[K]>) => Promise<ReturnType<typeof workerCommands[K]>>;
    } {
        let bridge = this;
        const caller: any = {};
        for (const command of Object.keys(workerCommands) as WorkerCommand[]) {
            caller[command] = (...args: any[]) => bridge.call(command, ...args as any);
        }
        return caller;
    }
}

