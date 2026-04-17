/* @refresh reload */
import { App } from "./client/App";
import "./client/GameUI.css";


const pages = {
    "Buildings": "client/tests/BuildingsTest",
    "Character Test": "client/tests/CharacterTest",
    "Curved Road": "client/tests/CurvedRoadTest",
    "Cut Road": "client/tests/CutRoadTest",
    "Game": "client/GamePage",
    "GamePart": "client/tests/GamePart",
    "Junction": "client/tests/JunctionTest",
    "Marbles Test": "client/tests/MarblesTest",
    "Maze": "client/tests/MazeTest",
    "Path": "client/tests/PathTest",
    "Quaternion": "client/tests/QuaternionTest",
    "Road shader": "client/tests/RoadShaderTest",
    "Round Corner": "client/tests/RoundCornerTest",
    "Round Corner Angles": "client/tests/RoundCornerAnglesTest",
    "Round DualWay": "client/tests/RoundDualWayTest",
    "Road Cut": "client/tests/RoadCutTest",
    "Road tool": "client/tests/RoadToolTest",
    "Simple Test": "client/tests/SimpleTest",
    "Stencil Buffer": "client/tests/StencilBufferTest",
    "Three Editor": "client/editor/ThreeEditor",

};

let app = new App(pages);
app.start();