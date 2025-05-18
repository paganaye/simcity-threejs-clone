import * as THREE from "three";
import { IPoint3D } from "../../sim/IPoint";

export type ActiveTool = "select" | "bulldoze" | "residential" | "commercial" | "industrial" | "road" | "power-plant" | "power-line";

export const simpleGeometries = {
    'Box': THREE.BoxGeometry,
    'Sphere': THREE.SphereGeometry,
    'Cylinder': THREE.CylinderGeometry,
    'Cone': THREE.ConeGeometry,
    'Torus': THREE.TorusGeometry,
    'Plane': THREE.PlaneGeometry,
    'Circle': THREE.CircleGeometry,
    'Ring': THREE.RingGeometry,
    'Tetrahedron': THREE.TetrahedronGeometry,
    'Octahedron': THREE.OctahedronGeometry,
    'Icosahedron': THREE.IcosahedronGeometry,
    'Dodecahedron': THREE.DodecahedronGeometry,
    'Capsule': THREE.CapsuleGeometry,
    'Tube': THREE.TubeGeometry,
};

export const geometryParameters: { [key: string]: any[] } = {
    'Box': [1, 1, 1],
    'Sphere': [0.5, 32, 16],
    'Cylinder': [0.5, 0.5, 1, 32],
    'Cone': [0.5, 1, 32],
    'Torus': [0.5, 0.2, 16, 100],
    'Plane': [1, 1],
    'Circle': [0.5, 32],
    'Ring': [0.2, 0.5, 32],
    'Tetrahedron': [1],
    'Octahedron': [1],
    'Icosahedron': [1],
    'Dodecahedron': [1],
    'Capsule': [0.5, 1, 4, 8],
    'Tube': [new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1, -1, 0),
        new THREE.Vector3(-0.5, 0.5, 0),
        new THREE.Vector3(0.5, -0.5, 0),
        new THREE.Vector3(1, 1, 0)
    ]), 0.2, 8, 6, false],
};

class ReactiveVector3 {
    _x: number = 0;
    _y: number = 0;
    _z: number = 0;

    constructor(readonly callBack: (newValue: IPoint3D, previousValue: IPoint3D, source: ReactiveVector3) => void) { }

    get x() { return this._x; }
    get y() { return this._y; }
    get z() { return this._z; }
    value() { return { x: this._x, y: this._y, z: this._z } }
    set x(newValue: number) { if (newValue != this._x) { let previousValue = this.value(); this._x = newValue; this.callBack(this.value(), previousValue, this) } }
    set y(newValue: number) { if (newValue != this._y) { let previousValue = this.value(); this._y = newValue; this.callBack(this.value(), previousValue, this) } }
    set z(newValue: number) { if (newValue != this._z) { let previousValue = this.value(); this._z = newValue; this.callBack(this.value(), previousValue, this) } }

    set(x: number, y: number, z: number, raiseEvent: boolean) {
        if (x != this._x || y != this._y || z != this._z) {
            let previousValue = this.value();
            this._x = x;
            this._y = y;
            this._z = z;
            if (raiseEvent) this.callBack(this.value(), previousValue, this);
        }
    }
}

class SelectedObject {
    public readonly object: THREE.Object3D;
    public readonly obbHelper: THREE.LineSegments;

    public readonly initialLocalPosition: THREE.Vector3;
    public readonly initialLocalRotation: THREE.Euler;
    public readonly initialLocalScale: THREE.Vector3;


    constructor(public editorSelection: EditorSelection, object: THREE.Object3D) {
        this.object = object;

        const mesh = object as THREE.Mesh;
        const geometry = mesh.geometry;

        if (!geometry.boundingBox) {
            geometry.computeBoundingBox();
        }
        const localBox = geometry.boundingBox as THREE.Box3;

        const obbHelper = new THREE.Box3Helper(localBox, 0xffff00);

        const material = obbHelper.material as THREE.LineBasicMaterial;
        material.depthTest = false;
        material.transparent = true;
        material.opacity = 1.0;
        obbHelper.renderOrder = 999;

        this.obbHelper = obbHelper;

        this.initialLocalPosition = object.position.clone();
        this.initialLocalRotation = object.rotation.clone();
        this.initialLocalScale = object.scale.clone();

        this.object.add(this.obbHelper);
    }

    dispose(): void {
        if (this.obbHelper.parent) {
            this.obbHelper.parent.remove(this.obbHelper);
        }
        (this.obbHelper.geometry as any).dispose();
        (this.obbHelper.material as any).dispose();
    }

    updateHelper(): void {

    }
}


export class EditorSelection {
    private readonly _selection: Map<THREE.Object3D, SelectedObject>;
    private _boundingBox: THREE.Box3 | null = null;

    public readonly size = new ReactiveVector3((newSize: IPoint3D, previousSize: IPoint3D) => {
        let mx = (previousSize.x === 0) ? (newSize.x === 0 ? 1 : 0) : newSize.x / previousSize.x;
        let my = (previousSize.y === 0) ? (newSize.y === 0 ? 1 : 0) : newSize.y / previousSize.y;
        let mz = (previousSize.z === 0) ? (newSize.z === 0 ? 1 : 0) : newSize.z / previousSize.z;

        let { x: cx, y: cy, z: cz } = this.position.value();

        for (let [object3D] of this._selection) {
            let { x, y, z } = object3D.position;
            let { x: sx, y: sy, z: sz } = object3D.scale;
            object3D.position.set((x - cx) * mx + cx, (y - cy) * my + cy, (z - cz) * mz + cz);
            object3D.scale.set(sx * mx, sy * my, sz * mz);
        }
        this.calculateBounds();
    });


    public readonly position = new ReactiveVector3((newPosition: IPoint3D, previousPosition: IPoint3D) => {
        let dx = newPosition.x - previousPosition.x;
        let dy = newPosition.y - previousPosition.y;
        let dz = newPosition.z - previousPosition.z;
        for (let [object3D] of this._selection) {
            let { x, y, z } = object3D.position;
            object3D.position.set(x + dx, y + dy, z + dz)
        }
    })

    public readonly rotation = new ReactiveVector3((newRotation: IPoint3D, previousRotation: IPoint3D) => {
        const center = this.position.value();
        const previousEuler = new THREE.Euler(previousRotation.x, previousRotation.y, previousRotation.z, 'XYZ');
        const newEuler = new THREE.Euler(newRotation.x, newRotation.y, newRotation.z, 'XYZ');

        const previousGroupQuaternion = new THREE.Quaternion().setFromEuler(previousEuler);
        const newGroupQuaternion = new THREE.Quaternion().setFromEuler(newEuler);

        const deltaQuaternionForPosition = new THREE.Quaternion().copy(newGroupQuaternion).multiply(previousGroupQuaternion.invert());

        const tempVector = new THREE.Vector3();

        for (let [object3D] of this._selection) {
            tempVector.copy(object3D.position);
            tempVector.sub(new THREE.Vector3(center.x, center.y, center.z));
            tempVector.applyQuaternion(deltaQuaternionForPosition);
            tempVector.add(new THREE.Vector3(center.x, center.y, center.z));
            object3D.position.copy(tempVector);

            object3D.setRotationFromEuler(newEuler);
        }

        this.calculateBounds();
    });

    readonly scene: THREE.Scene;
    get objectCount(): number { return this._selection.size; }

    private constructor(scene: THREE.Scene) {
        this.scene = scene;
        this._selection = new Map()
    }

    static fromObject(scene: THREE.Scene, object: THREE.Object3D<THREE.Object3DEventMap> | null): EditorSelection {
        let newSelection = new EditorSelection(scene);
        if (object) {
            const selectedObj = new SelectedObject(newSelection, object);
            newSelection._selection.set(object, selectedObj);
            newSelection.calculateBounds();
        }
        return newSelection;
    }

    static createEmpty(scene: THREE.Scene): EditorSelection {
        return new EditorSelection(scene);
    }

    private calculateBounds(): void {
        if (this._selection.size === 0) {
            this._boundingBox = null;
            this.position.set(0, 0, 0, false);
            this.size.set(0, 0, 0, false);
            this.rotation.set(0, 0, 0, false);
            return;
        }

        this._boundingBox = new THREE.Box3();
        const tempBox = new THREE.Box3();
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();

        let first = true;
        this._selection.forEach(selected => {
            if (selected.object instanceof THREE.Mesh) {
                selected.object.geometry.computeBoundingBox();
                tempBox.copy(selected.object.geometry.boundingBox as THREE.Box3);
                tempBox.applyMatrix4(selected.object.matrixWorld);
                if (first) {
                    this._boundingBox!.copy(tempBox);
                    first = false;
                } else {
                    this._boundingBox!.union(tempBox);
                }
            }
        });


        if (this._boundingBox) {
            this._boundingBox.getCenter(center);
            this._boundingBox.getSize(size);

            this.position.set(center.x, center.y, center.z, false);
            this.size.set(size.x, size.y, size.z, false);
        } else {
            this.position.set(0, 0, 0, false);
            this.size.set(0, 0, 0, false);
            this.rotation.set(0, 0, 0, false);
        }
    }


    has(object: THREE.Object3D): boolean {
        return this._selection.has(object);
    }

    get objects(): IterableIterator<THREE.Object3D> {
        return this._selection.keys();
    }

    get selectedObjects(): IterableIterator<SelectedObject> {
        return this._selection.values();
    }

    get color(): string {
        const firstSelected = this._selection.values().next().value?.object as THREE.Mesh | undefined;
        if (firstSelected?.material) {
            const material = Array.isArray(firstSelected.material) ? firstSelected.material[0] : firstSelected.material;
            if ((material as any).color) {
                return `#${((material as any).color as THREE.Color).getHexString()}`;
            }
        }
        return '#ffffff';
    }

    set color(hexColor: string) {
        const newColor = new THREE.Color(hexColor);
        this._selection.forEach(selected => {
            const mesh = selected.object as THREE.Mesh;
            if (mesh.material) {
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach(mat => {
                    if ((mat as any).color) {
                        ((mat as any).color as THREE.Color).copy(newColor);
                    }
                });
            }
        });
    }

    newSelectionWith(object: THREE.Object3D): EditorSelection {
        if (this._selection.has(object)) {
            return this;
        }
        let newSelection = new EditorSelection(this.scene);
        for (let [key, value] of this._selection) {
            value.editorSelection = newSelection;
            newSelection._selection.set(key, value);
        }
        const selectedObj = new SelectedObject(newSelection, object);
        newSelection._selection.set(object, selectedObj);
        newSelection.calculateBounds();
        return newSelection;
    }

    newSelectionWithout(object: THREE.Object3D): EditorSelection {
        if (!this._selection.has(object)) {
            return this;
        }
        const selectedObjToRemove = this._selection.get(object);
        let newSelection = new EditorSelection(this.scene);
        for (let [key, value] of this._selection) {
            if (key != object) {
                value.editorSelection = newSelection;
                newSelection._selection.set(key, value);
            }
        }
        selectedObjToRemove?.dispose();

        newSelection.calculateBounds();
        return newSelection;
    }

    toggle(object: THREE.Object3D): EditorSelection {
        if (this._selection.has(object)) {
            return this.newSelectionWithout(object);
        } else {
            return this.newSelectionWith(object);
        }
    }

    updateHelpers() {
    }

    dispose(): void {
        for (let selectedObj of this._selection.values()) {
            if (selectedObj.editorSelection === this) {
                selectedObj.dispose();
            }
        }
        this._selection.clear();
        this._boundingBox = null;
    }
}