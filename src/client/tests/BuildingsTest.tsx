import * as THREE from "three";
import { render } from 'solid-js/web';
import { appConstants } from "../../AppConstants";
import {
    commercialBuildings,
    type IAssetMeta,
    industrialBuildings,
    ModelName,
    modelsMetaData,
    residentialBuildings,
    type IFootprintPoint,
} from "../AssetManager";
import { GameScene3D } from "../GameScene3D";
import { GameUIComponent, UIProps } from "../GameUIComponent";
import { Page } from "../Page";

// Building catalogue: name, file, optional per-model scale, type color
const COLUMNS = 5; // models per row
const TILE = appConstants.BuildingsScale; // cell spacing in metres

// Colors per zone type
const FOOTPRINT_COLORS: Record<string, number> = {
    residential: 0x4caf50, // green
    commercial: 0x2196f3, // blue
    industrial: 0xff9800, // orange
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

type AccessPoint = { x: number; z: number; width: number; angle: number };

type BuildingAccess = {
    entryPoint: AccessPoint;
    exitPoint: AccessPoint;
};

type AccessHandle = {
    modelName: ModelName;
    key: "entryPoint" | "exitPoint";
    centerX: number;
    centerZ: number;
    point: AccessPoint;
    root: THREE.Group;
    pickMesh: THREE.Mesh;
    widthLine: THREE.Line;
    dirLine: THREE.Line;
};

function updateAccessHandleVisual(handle: AccessHandle) {
    const px = handle.centerX + handle.point.x;
    const pz = handle.centerZ + handle.point.z;
    const y = 0.12;

    handle.root.position.set(px, y, pz);

    const half = Math.max(0.2, handle.point.width * 0.5);
    const tx = -Math.sin(handle.point.angle);
    const tz = Math.cos(handle.point.angle);

    const widthPoints = [
        new THREE.Vector3(-tx * half, 0.01, -tz * half),
        new THREE.Vector3(tx * half, 0.01, tz * half),
    ];
    handle.widthLine.geometry.setFromPoints(widthPoints);

    const dirLen = Math.max(0.8, Math.min(2.2, handle.point.width));
    const dirPoints = [
        new THREE.Vector3(0, 0.015, 0),
        new THREE.Vector3(Math.cos(handle.point.angle) * dirLen, 0.015, Math.sin(handle.point.angle) * dirLen),
    ];
    handle.dirLine.geometry.setFromPoints(dirPoints);
}

function createAccessHandle(
    scene: THREE.Scene,
    modelName: ModelName,
    key: "entryPoint" | "exitPoint",
    centerX: number,
    centerZ: number,
    point: AccessPoint,
    color: number,
): AccessHandle {
    const root = new THREE.Group();
    scene.add(root);

    const pickMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.08, 14),
        new THREE.MeshBasicMaterial({ color, depthWrite: false })
    );
    root.add(pickMesh);

    const widthLine = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color })
    );
    root.add(widthLine);

    const dirLine = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color })
    );
    root.add(dirLine);

    const handle: AccessHandle = {
        modelName,
        key,
        centerX,
        centerZ,
        point,
        root,
        pickMesh,
        widthLine,
        dirLine,
    };
    updateAccessHandleVisual(handle);
    return handle;
}

function polygonSignedArea(points: IFootprintPoint[]): number {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        sum += a.x * b.z - b.x * a.z;
    }
    return sum * 0.5;
}

function pickFrontFacadeEdge(points: IFootprintPoint[]): { a: IFootprintPoint; b: IFootprintPoint; length: number } | undefined {
    if (points.length < 2) return undefined;

    let best: { a: IFootprintPoint; b: IFootprintPoint; length: number; midZ: number } | undefined;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const length = Math.hypot(dx, dz);
        if (length < 1e-4) continue;

        const midZ = (a.z + b.z) * 0.5;
        if (!best || midZ < best.midZ || (Math.abs(midZ - best.midZ) < 1e-6 && length > best.length)) {
            best = { a, b, length, midZ };
        }
    }

    return best ? { a: best.a, b: best.b, length: best.length } : undefined;
}


function modelAccessor(modelName: ModelName): string {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(modelName)
        ? `modelsMetaData.${modelName}`
        : `modelsMetaData[${JSON.stringify(modelName)}]`;
}

const BUILDINGS: BuildingEntry[] = [
    ...residentialBuildings.map((modelName) => ({ modelName, zoneType: "residential", label: modelName })),
    ...commercialBuildings.map((modelName) => ({ modelName, zoneType: "commercial", label: modelName })),
    ...industrialBuildings
        .filter((modelName) => modelName !== "power-plant")
        .map((modelName) => ({ modelName, zoneType: "industrial", label: modelName })),
];

export default class TestBuildings extends Page {
    scene3DInstance: GameScene3D | undefined;
    private accessHandles: AccessHandle[] = [];
    private selectedHandleModelName?: ModelName;

    get selectedObject() {
        return this.scene3DInstance?.selectedInstance;
    }

    #updateHandleVisibility() {
        const selectedModelName = this.selectedObject?.mesh.userData?.modelName as ModelName | undefined;
        if (selectedModelName === this.selectedHandleModelName) return;

        this.selectedHandleModelName = selectedModelName;
        for (const handle of this.accessHandles) {
            handle.root.visible = selectedModelName === handle.modelName;
        }
    }

    async run() {
        const handleUILoaded = async (uiProps: UIProps): Promise<void> => {
            this.scene3DInstance = new GameScene3D(uiProps);
            await this.scene3DInstance.init(this);

            this.camera.position.set(TILE * COLUMNS / 2, TILE * 4, TILE * 5);
            this.camera.lookAt(TILE * COLUMNS / 2, 0, TILE * 1.5);

            const assetManager = this.scene3DInstance.assetManager;

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
            const exportLines: string[] = [];
            const accessLines: string[] = [];
            this.accessHandles = [];

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

                const perimeterLiteral = JSON.stringify(footprint.polygon);
                exportLines.push(`${modelAccessor(entry.modelName)}.perimeter = ${perimeterLiteral};`);

                const modelMeta = modelsMetaData[entry.modelName as keyof typeof modelsMetaData] as IAssetMeta;
                if (modelMeta?.entryPoint) {
                    this.accessHandles.push(createAccessHandle(this.scene, entry.modelName, "entryPoint", cx, cz, modelMeta.entryPoint, 0x44dd66));
                }
                if (modelMeta?.exitPoint) {
                    this.accessHandles.push(createAccessHandle(this.scene, entry.modelName, "exitPoint", cx, cz, modelMeta.exitPoint, 0xdd4444));
                }


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

            console.log("=== COPY TO AssetManagerData.ts ===");
            console.log(exportLines.join("\n"));
            console.log("=== COPY ENTRY/EXIT TO AssetManagerData.ts ===");
            console.log(accessLines.join("\n"));

            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const dragHit = new THREE.Vector3();
            let activeHandle: AccessHandle | undefined;

            const pointerToNdc = (event: PointerEvent): THREE.Vector2 => {
                const rect = this.renderer.domElement.getBoundingClientRect();
                return mouse.set(
                    ((event.clientX - rect.left) / rect.width) * 2 - 1,
                    -((event.clientY - rect.top) / rect.height) * 2 + 1
                );
            };

            const emitAccessLine = (handle: AccessHandle) => {
                const modelMeta = (modelsMetaData as any)[handle.modelName as keyof typeof modelsMetaData] as IAssetMeta;
                modelMeta[handle.key] = {
                    x: handle.point.x,
                    z: handle.point.z,
                    width: handle.point.width,
                    angle: handle.point.angle,
                };
                console.log(`${modelAccessor(handle.modelName)}.${handle.key} = ${JSON.stringify(modelMeta[handle.key])};`);
            };

            this.renderer.domElement.addEventListener("pointerdown", (event: PointerEvent) => {
                if (this.accessHandles.length === 0) return;
                const ndc = pointerToNdc(event);
                raycaster.setFromCamera(ndc, this.camera);
                const visiblePickMeshes = this.accessHandles.filter((h) => h.root.visible).map((h) => h.pickMesh);
                const picks = raycaster.intersectObjects(visiblePickMeshes, false);
                if (picks.length === 0) return;

                activeHandle = this.accessHandles.find((h) => h.pickMesh === picks[0].object);
                if (!activeHandle) return;

                event.preventDefault();
                event.stopPropagation();
                if (this.controls) this.controls.enabled = false;
                this.renderer.domElement.style.cursor = "grabbing";
            }, true);

            this.renderer.domElement.addEventListener("pointermove", (event: PointerEvent) => {
                if (!activeHandle) return;

                const ndc = pointerToNdc(event);
                raycaster.setFromCamera(ndc, this.camera);
                if (!raycaster.ray.intersectPlane(dragPlane, dragHit)) return;

                event.preventDefault();
                event.stopPropagation();

                activeHandle.point.x = dragHit.x - activeHandle.centerX;
                activeHandle.point.z = dragHit.z - activeHandle.centerZ;
                updateAccessHandleVisual(activeHandle);
            }, true);

            const stopDrag = (event?: PointerEvent) => {
                if (!activeHandle) return;
                event?.preventDefault();
                event?.stopPropagation();
                emitAccessLine(activeHandle);
                activeHandle = undefined;
                if (this.controls) this.controls.enabled = true;
                this.renderer.domElement.style.cursor = "";
            };

            this.renderer.domElement.addEventListener("pointerup", stopDrag);
            this.renderer.domElement.addEventListener("pointercancel", stopDrag);

            this.#updateHandleVisibility();
            uiProps.isLoading.set(false);
        };

        render(() => <GameUIComponent page={this} onUILoaded={handleUILoaded} />, this.appContainer);
    }

    override loop(elapsed: number): void {
        this.scene3DInstance?.drawFrame(elapsed);
        this.#updateHandleVisibility();
    }

    override cleanup(): void {
    }
}
