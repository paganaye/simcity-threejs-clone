import * as THREE from "three";
import { IOrientation2D } from "../sim/IPoint";





export class RoadBuilder implements IOrientation2D {
    x: number;
    y: number;
    z: number;
    angle: number;
    textureProgressU: number = 0;

    static roadTexture: THREE.DataTexture;
    static roadMaterial: THREE.MeshStandardMaterial;

    static LINE_REPEAT_PER_UNIT = 16;
    static ROAD_GRAY = 'hsl(0, 2%, 3.5%)';
    static PAVEMENT_COLOR = 'hsl(230, 3%, 40.0%)';
    static YELLOW_LINE = 'hsl(66, 33.90%, 43.90%)';
    static YELLOW_LINE_WIDTH = 4;
    static PAVEMENT_WIDTH = 12;
    static ROAD_WIDTH = 0.3;
    static TEXTURE_WIDTH = 32;
    static ROAD_HEIGHT = 64; // including pavement and lines
    static TRANSPARENT_AREA = 32;
    static TEXTURE_HEIGHT = 128;
    static TURNING_SEGMENTS_MULTIPLIER = 4;


    constructor(startPosition: IOrientation2D, readonly scene: THREE.Scene) {
        this.x = startPosition.x;
        this.y = startPosition.y ?? 0;
        this.z = startPosition.z;
        this.angle = startPosition.angle;
    }

    static {
        this.roadTexture = this.createRoadTexture();
        this.roadMaterial = new THREE.MeshStandardMaterial({
            map: this.roadTexture,
            side: THREE.DoubleSide,
        });

    }

    static createRoadTexture() {

        const canvas = document.createElement('canvas');
        canvas.width = RoadBuilder.TEXTURE_WIDTH;
        canvas.height = RoadBuilder.ROAD_HEIGHT;
        const ctx = canvas.getContext('2d')!; // Utilisation de l'assertion non-null


        // Dessiner le fond gris
        ctx.fillStyle = RoadBuilder.ROAD_GRAY;
        ctx.fillRect(0, 0, RoadBuilder.TEXTURE_WIDTH, RoadBuilder.ROAD_HEIGHT);

        ctx.fillStyle = RoadBuilder.PAVEMENT_COLOR;
        ctx.fillRect(0, 0, RoadBuilder.TEXTURE_WIDTH, RoadBuilder.PAVEMENT_WIDTH);
        ctx.fillRect(0, RoadBuilder.ROAD_HEIGHT - RoadBuilder.PAVEMENT_WIDTH, RoadBuilder.TEXTURE_WIDTH, RoadBuilder.PAVEMENT_WIDTH);
        ctx.fillStyle = RoadBuilder.YELLOW_LINE;
        ctx.fillRect(0, (RoadBuilder.ROAD_HEIGHT - RoadBuilder.YELLOW_LINE_WIDTH) / 2, RoadBuilder.TEXTURE_WIDTH / 2, RoadBuilder.YELLOW_LINE_WIDTH);


        const imageData = ctx.getImageData(0, 0, RoadBuilder.TEXTURE_WIDTH, RoadBuilder.ROAD_HEIGHT);
        const data = new Uint8Array(imageData.data);

        const texture = new THREE.DataTexture(
            data,
            RoadBuilder.TEXTURE_WIDTH,
            RoadBuilder.ROAD_HEIGHT,
            THREE.RGBAFormat
        );
        texture.needsUpdate = true;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;


        // Obtenir la data URL de l'image
        const imageDataURL = canvas.toDataURL('image/png');

        // // Ouvrir une nouvelle fenêtre
        // const newWindow = window.open('', '_blank');

        // // S'assurer que la fenêtre est correctement ouverte avant d'y écrire
        // if (newWindow) {
        //     // Injecter du HTML pour afficher l'image
        //     newWindow.document.write(`<img src="${imageDataURL}">`);
        // } else {
        //     console.error("La fenêtre popup n'a pas pu s'ouvrir. Veuillez vérifier les paramètres de votre navigateur.");
        // }
        document.body.innerHTML += `<img style="position:fixed; top:20px; left:80px;" src="${imageDataURL}" >`;
        return texture;
    }

    addSphere(x: number, z: number) {
        const geometry = new THREE.SphereGeometry(0.05);
        const material = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(x, 0, z);
        this.scene.add(sphere);
    }

    addStraightRoad(length: number) {
        const geometry = new THREE.PlaneGeometry(length, RoadBuilder.ROAD_WIDTH);
        const road = new THREE.Mesh(geometry, RoadBuilder.roadMaterial);

        const dx = Math.cos(this.angle) * length;
        const dz = -Math.sin(this.angle) * length;

        road.position.set(
            this.x + dx / 2,
            this.y,
            this.z + dz / 2
        );

        road.rotation.x = -Math.PI / 2;
        road.rotation.z = this.angle;

        let repeat = length * RoadBuilder.LINE_REPEAT_PER_UNIT;
        const startU = this.textureProgressU;
        const endU = startU + repeat;

        const newUVArray = [
            startU, 0,
            endU, 0,
            startU, 1,
            endU, 1];
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(newUVArray, 2));

        this.scene.add(road);

        this.x += dx;
        this.z += dz;
        this.textureProgressU = endU; // Mise à jour de la progression
    }

    addTurningRoad(turnAngle: number, radius: number) {
        if (Math.abs(turnAngle) < 0.001) return;
        const segments = Math.max(1, Math.round(Math.abs(RoadBuilder.TURNING_SEGMENTS_MULTIPLIER * turnAngle)));
        const initialRoadAngle = this.angle;
        const finalRoadAngle = initialRoadAngle + turnAngle;
        const centerCalcDirection = turnAngle > 0 ? -1 : 1;
        const cx = this.x + Math.sin(initialRoadAngle) * radius * centerCalcDirection;
        const cz = this.z + Math.cos(initialRoadAngle) * radius * centerCalcDirection;

        const geomAngleOffset = turnAngle > 0 ? -Math.PI / 2 : +Math.PI / 2;

        const vertices: number[] = [];
        const uvs: number[] = [];
        const totalCurveAngle = Math.abs(turnAngle);
        const curveLength = radius * totalCurveAngle;
        const startU = this.textureProgressU;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const currentTangentAngle = initialRoadAngle + t * turnAngle;
            const geometryRayAngle = currentTangentAngle + geomAngleOffset;

            const cosRay = Math.cos(geometryRayAngle);
            const sinRay = Math.sin(geometryRayAngle);

            const innerX = cx + cosRay * (radius - RoadBuilder.ROAD_WIDTH / 2);
            const innerZ = cz - sinRay * (radius - RoadBuilder.ROAD_WIDTH / 2);
            const outerX = cx + cosRay * (radius + RoadBuilder.ROAD_WIDTH / 2);
            const outerZ = cz - sinRay * (radius + RoadBuilder.ROAD_WIDTH / 2);

            vertices.push(innerX, this.y, innerZ);
            vertices.push(outerX, this.y, outerZ);

            // Calcul de la coordonnée U (le long de la courbe)
            const u = (radius * Math.abs(turnAngle) * t) * RoadBuilder.LINE_REPEAT_PER_UNIT;
            // La coordonnée V (largeur) va de 0 à 1 (arbitrairement, on peut choisir l'ordre)
            uvs.push(u, 0); // Sommet intérieur
            uvs.push(u, 1); // Sommet extérieur
        }
        this.textureProgressU = startU + curveLength * RoadBuilder.LINE_REPEAT_PER_UNIT; // Mise à jour de la progression

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); // Ajout des coordonnées UV

        const indices: number[] = [];
        for (let i = 0; i < segments; i++) {
            const a = i * 2; // inner1
            const b = a + 1; // outer1
            const c = a + 2; // inner2
            const d = a + 3; // outer2
            indices.push(a, b, d);
            indices.push(a, d, c);
        }
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, RoadBuilder.roadMaterial);
        this.scene.add(mesh);

        this.angle = finalRoadAngle;
        const finalGeometryRayAngle = finalRoadAngle + geomAngleOffset;
        this.x = cx + Math.cos(finalGeometryRayAngle) * radius;
        this.z = cz - Math.sin(finalGeometryRayAngle) * radius;

    }

}
