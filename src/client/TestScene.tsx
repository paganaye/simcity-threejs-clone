import * as THREE from "three";
import { DEG2RAD } from "three/src/math/MathUtils";
import { RoadBuilder } from "./RoadBuilder";


function angle(angleInDegree: number) {
    return DEG2RAD * angleInDegree;
}


export function testScene(scene: THREE.Scene) {

    let radius = 1;

    const builder = new RoadBuilder({ x: -1, y: 0.01, z: 4, angle: 0 }, scene);
    builder.addStraightRoad(1);
    builder.addTurningRoad(angle(30), radius);
    builder.addStraightRoad(2);
    builder.addTurningRoad(angle(-30), radius);
    builder.addStraightRoad(1);
    builder.addTurningRoad(angle(90), radius);
    builder.addStraightRoad(4.2);
    builder.addTurningRoad(angle(90), radius);
    builder.addStraightRoad(4.2);
    builder.addTurningRoad(angle(90), radius);
    builder.addStraightRoad(3.6);
    builder.addTurningRoad(angle(-30), radius);
    builder.addStraightRoad(1);
    builder.addTurningRoad(angle(120), radius);
    builder.addStraightRoad(1);


}


