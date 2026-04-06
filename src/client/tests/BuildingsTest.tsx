import * as THREE from "three";
import { render } from "solid-js/web";
import { appConstants } from "../../AppConstants";
import {
    IFastMesh,
    type IAssetMeta,
    ModelName,
    modelsMetaData,
    residentialBuildings,
} from "../AssetManager";
import type { ISelectedInstance } from "../editor/CustomGizmo";
import { GameScene3D } from "../GameScene3D";
import { GameUIComponent, UIProps } from "../GameUIComponent";
import { Page } from "../Page";

const TILE = appConstants.BuildingsScale;

type AccessPoint = { x: number; z: number; width: number; angle: number };

type AccessHandle = {
    key: "entryPoint" | "exitPoint";
    centerX: number;
    centerZ: number;
    point: AccessPoint;
    root: THREE.Group;
    pickMesh: THREE.Mesh;
};

function updateAccessHandleVisual(handle: AccessHandle) {
    const px = handle.centerX + handle.point.x;
    const pz = handle.centerZ + handle.point.z;

    handle.root.position.set(px, 0.2, pz);
}

function createAccessHandle(
    scene: THREE.Scene,
    key: "entryPoint" | "exitPoint",
    centerX: number,
    centerZ: number,
    point: AccessPoint,
    color: number,
): AccessHandle {
    const root = new THREE.Group();
    root.userData.selectableType = "access-point";
    root.userData.handleKey = key;
    scene.add(root);

    const pickMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 20, 20),
        new THREE.MeshBasicMaterial({
            color,
            depthWrite: false,
            depthTest: false,
            transparent: true,
            opacity: 0.95,
        }),
    );
    pickMesh.renderOrder = 1001;
    pickMesh.userData.selectableType = "access-point";
    pickMesh.userData.handleKey = key;
    root.add(pickMesh);

    const handle: AccessHandle = {
        key,
        centerX,
        centerZ,
        point,
        root,
        pickMesh,
    };
    updateAccessHandleVisual(handle);
    return handle;
}

export default class TestBuildings extends Page {
    scene3DInstance: GameScene3D | undefined;

    private currentBuilding?: {
        modelName: ModelName;
        mesh: IFastMesh;
        selected: ISelectedInstance;
    };
    private accessHandles: AccessHandle[] = [];
    private activeAccessHandle?: AccessHandle;
    private readonly guiState = {
        building: residentialBuildings[0] as ModelName,
    };

    private readonly tempMatrix = new THREE.Matrix4();
    private readonly tempPosition = new THREE.Vector3();
    private readonly tempQuaternion = new THREE.Quaternion();
    private readonly tempScale = new THREE.Vector3();
    private readonly tempWorldPosition = new THREE.Vector3();

    #clearAccessHandles() {
        for (const handle of this.accessHandles) {
            this.scene.remove(handle.root);
            handle.pickMesh.geometry.dispose();
            (handle.pickMesh.material as THREE.Material).dispose();
        }
        this.accessHandles = [];
        this.activeAccessHandle = undefined;
    }

    #buildingCenter(): { x: number; z: number } {
        if (!this.currentBuilding) return { x: 0, z: 0 };
        this.currentBuilding.selected.mesh.getMatrixAt(this.currentBuilding.selected.instanceId, this.tempMatrix);
        this.tempMatrix.decompose(this.tempPosition, this.tempQuaternion, this.tempScale);
        return { x: this.tempPosition.x, z: this.tempPosition.z };
    }

    #syncAccessHandlesWithBuilding() {
        if (!this.currentBuilding) return;

        const { x: centerX, z: centerZ } = this.#buildingCenter();
        const meta = modelsMetaData[this.currentBuilding.modelName as keyof typeof modelsMetaData] as IAssetMeta;

        for (const handle of this.accessHandles) {
            handle.centerX = centerX;
            handle.centerZ = centerZ;

            if (this.activeAccessHandle === handle) {
                handle.root.getWorldPosition(this.tempWorldPosition);
                handle.point.x = this.tempWorldPosition.x - centerX;
                handle.point.z = this.tempWorldPosition.z - centerZ;
            } else {
                updateAccessHandleVisual(handle);
            }

            meta[handle.key] = {
                x: handle.point.x,
                z: handle.point.z,
                width: handle.point.width,
                angle: handle.point.angle,
            };
        }
    }

    #selectAccessHandle(handle?: AccessHandle) {
        this.activeAccessHandle = handle;
        if (!this.scene3DInstance?.customGizmo) return;

        if (!handle) {
            this.scene3DInstance.customGizmo.clearSelection();
            this.scene3DInstance.customGizmo.syncSelectionFromSelectedInstance();
            return;
        }

        this.scene3DInstance.customGizmo.setSelection(handle.root);
    }

    #setBuilding(modelName: ModelName, uiProps: UIProps) {
        if (!this.scene3DInstance) return;

        if (this.currentBuilding) {
            this.scene3DInstance.assetManager.removeFastMesh(this.currentBuilding.mesh);
            this.currentBuilding = undefined;
        }

        const fastMesh = this.scene3DInstance.assetManager.addFastMesh(modelName, 0, 0, 0, 0);
        const selected: ISelectedInstance = {
            mesh: fastMesh.parent.instancedMesh,
            instanceId: fastMesh.index,
            selectableType: "building",
        };

        this.currentBuilding = {
            modelName,
            mesh: fastMesh,
            selected,
        };

        this.scene3DInstance.selectedInstance = selected;
        uiProps.selectedInstance.set(selected);
        this.scene3DInstance.customGizmo?.syncSelectionFromSelectedInstance();

        const meta = modelsMetaData[modelName as keyof typeof modelsMetaData] as IAssetMeta;
        const center = this.#buildingCenter();

        const entry: AccessPoint = meta.entryPoint ?? { x: 0, z: -1.5, width: 2, angle: Math.PI / 2 };
        const exit: AccessPoint = meta.exitPoint ?? { x: 0, z: 1.5, width: 2, angle: -Math.PI / 2 };

        this.#clearAccessHandles();
        this.accessHandles.push(createAccessHandle(this.scene, "entryPoint", center.x, center.z, entry, 0x44dd66));
        this.accessHandles.push(createAccessHandle(this.scene, "exitPoint", center.x, center.z, exit, 0xdd4444));

        this.#selectAccessHandle(this.accessHandles[0]);
    }

    #setupGui(uiProps: UIProps) {
        const selectionFolder = this.gui?.addFolder("Selection");
        selectionFolder
            ?.add(this.guiState, "building", residentialBuildings)
            .name("Building")
            .onChange((modelName: ModelName) => {
                this.#setBuilding(modelName, uiProps);
            });
        selectionFolder?.open();

    }

    async run() {
        const handleUILoaded = async (uiProps: UIProps): Promise<void> => {
            uiProps.selectionFilter = (selected) => {
                return selected.selectableType !== "building";
            }

            this.scene3DInstance = new GameScene3D(uiProps);
            this.scene3DInstance.isCustomGizmoSelectableObject = (obj) => {
                return this.accessHandles.some((handle) => handle.pickMesh === obj || handle.root === obj);
            };
            this.scene3DInstance.onCustomGizmoObjectSelected = (obj) => {
                const handle = this.accessHandles.find((item) => item.pickMesh === obj || item.root === obj);
                if (!handle) return;
                this.#selectAccessHandle(handle);
            };
            await this.scene3DInstance.init(this);

            this.camera.position.set(0, TILE * 3.2, TILE * 3.8);
            this.camera.lookAt(0, 0, 0);

            this.#setupGui(uiProps);
            this.#setBuilding(this.guiState.building, uiProps);
            uiProps.isLoading.set(false);
        };

        render(() => <GameUIComponent page={this} onUILoaded={handleUILoaded} />, this.appContainer);
    }

    override loop(elapsed: number): void {
        this.scene3DInstance?.drawFrame(elapsed);
        this.#syncAccessHandlesWithBuilding();
    }

    override cleanup(): void {
        if (this.currentBuilding && this.scene3DInstance) {
            this.scene3DInstance.assetManager.removeFastMesh(this.currentBuilding.mesh);
            this.currentBuilding = undefined;
        }
        this.#clearAccessHandles();
    }
}
