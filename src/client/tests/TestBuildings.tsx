import * as THREE from "three";
import { appConstants } from "../../AppConstants";
import {
    AssetManager,
    commercialBuildings,
    industrialBuildings,
    ModelName,
    residentialBuildings,
    type IFootprintPoint,
} from "../AssetManager";
import { Page } from "../Page";

// Building catalogue: name, file, optional per-model scale, type color
const COLUMNS = 9; // models per row
const TILE = appConstants.BuildingsScale; // cell spacing in metres

// Colors per zone type
const FOOTPRINT_COLORS: Record<string, number> = {
    residential: 0x4caf50, // green
    commercial:  0x2196f3, // blue
    industrial:  0xff9800, // orange
};

interface BuildingEntry {
    modelName: ModelName;
    zoneType: string;
    label: string;
}

interface FootprintJsonEntry {
    label: string;
    modelName: ModelName;
    zoneType: string;
    baseY: number;
    centerX: number;
    centerZ: number;
    width: number;
    depth: number;
    polygon: IFootprintPoint[];
}

const BUILDINGS: BuildingEntry[] = [
    ...residentialBuildings.map((modelName) => ({ modelName, zoneType: "residential", label: modelName })),
    ...commercialBuildings.map((modelName) => ({ modelName, zoneType: "commercial", label: modelName })),
    ...industrialBuildings
        .filter((modelName) => modelName !== "power-plant")
        .map((modelName) => ({ modelName, zoneType: "industrial", label: modelName })),
];

export default class TestBuildings extends Page {
    async run() {
        this.camera.position.set(TILE * COLUMNS / 2, TILE * 4, TILE * 5);
        this.camera.lookAt(TILE * COLUMNS / 2, 0, TILE * 1.5);

        const assetManager = new AssetManager({ scene: this.scene } as any);
        await assetManager.init();

        const footprintMats: Record<string, THREE.MeshBasicMaterial> = {};
        for (const [type, color] of Object.entries(FOOTPRINT_COLORS)) {
            footprintMats[type] = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.35,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
        }

        const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });

        BUILDINGS.forEach((entry, i) => {
            const col = i % COLUMNS;
            const row = Math.floor(i / COLUMNS);
            const cx = col * TILE;
            const cz = row * TILE;

            assetManager.addFastMesh(entry.modelName, cx, 0, cz, 0);

            const footprint = assetManager.getModelFootprint(entry.modelName);
            if (!footprint || footprint.polygon.length < 3) {
                return null;
            }

            const polyWorld = footprint.polygon.map((p) => new THREE.Vector2(cx + p.x, cz + p.z));
            const polyShape = new THREE.Shape(polyWorld);
            const polyGeo = new THREE.ShapeGeometry(polyShape);
            polyGeo.rotateX(Math.PI / 2);

            const polyMesh = new THREE.Mesh(polyGeo, footprintMats[entry.zoneType]);
            polyMesh.position.y = 0.02;
            this.scene.add(polyMesh);

            const edgePoints = [...polyWorld, polyWorld[0]].map((p) => new THREE.Vector3(p.x, 0.03, p.y));
            const edges = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(edgePoints),
                edgeMat
            );
            this.scene.add(edges);

            return {
                label: entry.label,
                modelName: entry.modelName,
                zoneType: entry.zoneType,
                baseY: footprint.baseY,
                centerX: footprint.centerX,
                centerZ: footprint.centerZ,
                width: footprint.width,
                depth: footprint.depth,
                polygon: footprint.polygon,
            } satisfies FootprintJsonEntry;
        });

    }
}
