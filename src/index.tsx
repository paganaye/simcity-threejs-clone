/* @refresh reload */
import { App } from "./client/App";
import "./client/GameUI.css";


const pages = {
    "Buildings": "client/tests/BuildingsTest",
    "Character Test": "client/tests/CharacterTest",
    "Game": "client/GamePage",
    "Gizmo": "client/tests/GizmoTest",
    "Marbles Test": "client/tests/MarblesTest",
    "Maze": "client/tests/MazeTest",
    "Path": "client/tests/PathTest",
    "QuaternionTest": "client/tests/QuaternionTest",
    "Road Builder": "client/tests/RoadBuilderTest",
    "Simple Test": "client/tests/SimpleTest",
    "Stencil Buffer": "client/tests/StencilBufferTest",
    "Three Editor": "client/editor/ThreeEditor",
    "GamePart": "client/tests/GamePart",

};

let app = new App(pages);
app.start();