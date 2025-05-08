//import { Game } from "./Game";


//let game: Game;

self.onmessage = async (event) => {
    const { command, payload } = event.data;
    switch (command) {
        case "onDraw":
            //game.onDraw(payload.deltaSec, payload.speed)
            break;
        case "tick":
            postWorkerMessage("state", { heure: payload.heure + 1 });
            break;
        case "runSimulation":
            break;
        case "init":
            //game = new Game(payload);
            //let response = game.init();
            //game.start();
            //postWorkerMessage("init", { response, world: game.getIWorld(), people: game.getIPeople() });
            break;
        default:
            console.log("self.onmessage Unknown command", command);
            postWorkerMessage("error", { message: "Unknown command " + command });
    }
};


export function postWorkerMessage(command: string, payload: any) {
    self.postMessage({ command, payload });

}