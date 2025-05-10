import { init } from "./Init";

function add(a: number, b: number): number {
    return a + b;
}

export const workerCommands = {
    add,
    init
};


export type WorkerCommands = typeof workerCommands;
export type WorkerCommand = keyof WorkerCommands;

export interface IWorkerRequest {
    id: number;
    command: WorkerCommand;
    args: any[]
}

export type IWorkerResponse = IWorkerSuccess | IWorkerError;

export type IWorkerSuccess = {
    id: number;
    command: WorkerCommand;
    success: true;
    result: any
}
export type IWorkerError = {
    id: number;
    command: WorkerCommand;
    success: false;
    error: string;
    stack: string
}

self.onmessage = async (event) => {
    const request = event.data as IWorkerRequest;
    let { id, command } = request;

    let response: IWorkerSuccess | IWorkerResponse;
    try {
        const handler = workerCommands[command as WorkerCommand] as any;
        if (!handler) throw new Error("Unknown command " + command);
        const result =await handler(...request.args);
        response = { id, command, success: true, result };
    } catch (e: any) {
        response = { id, command, success: false, error: String(e), stack: e.stack };
    }

    self.postMessage(response);
};


