import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";


const ROAD_WIDTH = 0.25;


type Position = { x: number; z: number; angle: number };

export class RoadBuilder {
    private position: Position;
    private scene: THREE.Scene;

    constructor(start: Position, scene: THREE.Scene) {
        this.position = { ...start };
        this.scene = scene;
    }

    addStraightRoad(length: number) {
        const geometry = new THREE.BoxGeometry(length, 0.01, ROAD_WIDTH);
        const material = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const road = new THREE.Mesh(geometry, material);

        const dx = Math.cos(this.position.angle) * (length / 2);
        const dz = Math.sin(this.position.angle) * (length / 2);

        road.position.set(
            this.position.x + dx,
            0,
            this.position.z + dz
        );
        road.rotation.y = -this.position.angle;

        this.scene.add(road);

        this.position.x += Math.cos(this.position.angle) * length;
        this.position.z += Math.sin(this.position.angle) * length;
    }

    addTurningRoad(length: number, radius: number) {
        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(radius, 0, radius),
            new THREE.Vector3(2 * radius, 0, 0)
        );

        const points = curve.getPoints(20);
        const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, ROAD_WIDTH / 2, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.rotation.y = -this.position.angle;
        mesh.position.set(this.position.x, 0, this.position.z);

        this.scene.add(mesh);

        // update approximate position (rough)
        this.position.x += Math.cos(this.position.angle + Math.PI / 4) * radius * 2;
        this.position.z += Math.sin(this.position.angle + Math.PI / 4) * radius * 2;
        this.position.angle += Math.PI / 2;
    }
}


function main(scene: THREE.Scene) {
    let radius = 10;
    const builder = new RoadBuilder({ x: 0, z: 0, angle: 0 }, scene);
    builder.addStraightRoad(5);
    builder.addTurningRoad(25, radius);
    builder.addStraightRoad(10);
    builder.addTurningRoad(25, radius);

}

function makeScene(container: HTMLDivElement) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 5, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(width, height);
    new OrbitControls(camera, renderer.domElement);
    container.appendChild(renderer.domElement);

    main(scene)
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7.5);
    scene.add(light);

    const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    };
    animate();
}

export function Test() {
    return <div ref={el => makeScene(el)} />;
}
