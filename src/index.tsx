/* @refresh reload */
import { App } from "./client/App";


const pages = {
    "Buildings": "client/tests/TestBuildings",
    "Character Test": "client/tests/CharacterTest",
    "Game": "client/GamePage",
    "Gizmo": "client/tests/GizmoTest",
    "Marbles Test": "client/tests/MarblesTest",
    "Maze": "client/tests/MazeTest",
    "Path": "client/tests/PathTest",
    "QuaternionTest": "client/tests/QuaternionTest",
    "Road Scene": "client/tests/RoadSceneTest",
    "Simple Test": "client/tests/SimpleTest",
    "Stencil Buffer": "client/tests/StencilBufferTest",
    "Three Editor": "client/editor/ThreeEditor",

};

let app = new App(pages);
app.start();