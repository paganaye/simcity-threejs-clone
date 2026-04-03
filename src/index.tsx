/* @refresh reload */
import { App } from "./client/App";


const pages = {
    "Marbles Test": "client/tests/MarblesTest",
    "Road Scene": "client/tests/RoadSceneTest",
    "Stencil Buffer": "client/tests/StencilBufferTest",
    "Character Test": "client/tests/CharacterTest",
    "Simple Test": "client/tests/SimpleTest",
    "Three Editor": "client/editor/ThreeEditor",
    "Game": "client/GamePage",
    "Maze": "client/tests/MazeTest",
    "Buildings": "client/tests/TestBuildings"
};

let app = new App(pages);
app.start();