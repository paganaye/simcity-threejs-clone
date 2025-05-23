import * as THREE from 'three';
import { RoadBuilder } from '../RoadBuilder';
import { angle } from '../../utils/angle';
import { Page } from '../Page';
//import { angle } from '../../utils/angle';

export default class RoadScene extends Page {
    async run() {
        const cubeGeometry = new THREE.BoxGeometry();
        const material = new THREE.MeshStandardMaterial();
        const cube = new THREE.Mesh(cubeGeometry, material);
        this.scene.add(cube);


        let radius = 1;

        //      const builder =
        let builder = new RoadBuilder({ x: -1, y: 0.015, z: 4, angle: 0 }, this.scene);
        builder.addStraightRoad(1, 'none', 'l1');
        builder.addTurningRoad(angle(30), radius, 'none', 'l1');
        builder.addStraightRoad(2, 'none', 'l2');
        builder.addTurningRoad(angle(-30), radius, 'none', 'l2');
        builder.addStraightRoad(1, 'none', 'l3');
        builder.addTurningRoad(angle(90), radius, 'none', 'l3');
        builder.addStraightRoad(4.2, 'l3', 'l3');
        builder.addTurningRoad(angle(90), radius, 'l4');
        builder.addStraightRoad(4.2, 'l5');
        builder.addTurningRoad(angle(90), radius, 'l5');
        builder.addStraightRoad(3.6, 'l6');
        builder.addTurningRoad(angle(-30), radius, 'l6');
        builder.addStraightRoad(1, 'l1', 'l1');
        builder.addTurningRoad(angle(120), radius, 'l1', 'l1');
        builder.addStraightRoad(0.25, 'none', 'l1');

    }






}


