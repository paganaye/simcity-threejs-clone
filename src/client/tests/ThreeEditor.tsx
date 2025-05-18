import * as THREE from "three";
import { SceneContext, SceneInitResult } from "../..";
import { render } from "solid-js/web";
import { createSignal, createEffect } from "solid-js";
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // NON

import "./ThreeEditor.css"; // OUI
import { IPoint3D } from "../../sim/IPoint";

export type ActiveTool = "select" | "bulldoze" | "residential" | "commercial" | "industrial" | "road" | "power-plant" | "power-line";

const simpleGeometries = {
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

const geometryParameters: { [key: string]: any[] } = {
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

class SelectedObject {
    public readonly object: THREE.Object3D;
    public readonly highlightHelper: THREE.BoxHelper;
    public readonly originalPosition: THREE.Vector3;
    public readonly originalRotation: THREE.Euler;
    public readonly originalScale: THREE.Vector3;

    constructor(public editorSelection: EditorSelection, object: THREE.Object3D) {
        this.object = object;

        this.highlightHelper = new THREE.BoxHelper(object, 0xffff00);
        if (Array.isArray(this.highlightHelper.material)) {
            this.highlightHelper.material.forEach(mat => {
                mat.depthTest = false;
                mat.transparent = true;
                mat.opacity = 1.0;
            });
        } else {
            this.highlightHelper.material.depthTest = false;
            this.highlightHelper.material.transparent = true;
            this.highlightHelper.material.opacity = 1.0;
        }
        this.highlightHelper.renderOrder = 999;

        this.originalPosition = object.position.clone();
        this.originalRotation = object.rotation.clone();
        this.originalScale = object.scale.clone();

        editorSelection.scene.add(this.highlightHelper);
    }

    dispose(): void {
        this.editorSelection.scene.remove(this.highlightHelper);
        this.highlightHelper.dispose();
    }

    updateHelper(): void {
        this.highlightHelper.update();
    }
}


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

class EditorSelection {
    private readonly _selection: Map<THREE.Object3D, SelectedObject>;
    private _boundingBox: THREE.Box3 | null = null;

    public readonly size = new ReactiveVector3((newPosition: IPoint3D, previousPosition: IPoint3D) => {
        let mx = newPosition.x / previousPosition.x;
        let my = newPosition.y / previousPosition.y;
        let mz = newPosition.z / previousPosition.z;
        let { x: cx, y: cy, z: cz } = this.position.value();
        for (let [object3D, selectedObject] of this._selection) {
            let { x, y, z } = object3D.position;
            let { x: sx, y: sy, z: sz } = object3D.scale;
            object3D.position.set((x - cx) * mx + cx, (y - cy) * my + cy, (z - cz) * mz + cz);
            object3D.scale.set(sx * mx, sy * my, sz * mz)
            selectedObject.updateHelper();
        }
    });

    public readonly position = new ReactiveVector3((newPosition: IPoint3D, previousPosition: IPoint3D) => {
        let dx = newPosition.x - previousPosition.x;
        let dy = newPosition.y - previousPosition.y;
        let dz = newPosition.z - previousPosition.z;
        for (let [object3D, selectedObject] of this._selection) {
            let { x, y, z } = object3D.position;
            object3D.position.set(x + dx, y + dy, z + dz)
            selectedObject.updateHelper();
        }
    })

    public readonly rotation = new ReactiveVector3((newRotation: IPoint3D, previousRotation: IPoint3D) => {
        const center = this.position.value();
        const previousEuler = new THREE.Euler(previousRotation.x, previousRotation.y, previousRotation.z);
        const newEuler = new THREE.Euler(newRotation.x, newRotation.y, newRotation.z);

        const previousGroupQuaternion = new THREE.Quaternion().setFromEuler(previousEuler);
        const newGroupQuaternion = new THREE.Quaternion().setFromEuler(newEuler);

        const deltaQuaternionForPosition = new THREE.Quaternion().copy(newGroupQuaternion).multiply(previousGroupQuaternion.invert());

        const tempVector = new THREE.Vector3();

        for (let [object3D, selectedObject] of this._selection) {
            tempVector.copy(object3D.position);
            tempVector.sub(center);
            tempVector.applyQuaternion(deltaQuaternionForPosition);
            tempVector.add(center);
            object3D.position.copy(tempVector);

            // Ignorer initialLocalRotation et appliquer directement la nouvelle orientation absolue du groupe
            object3D.quaternion.copy(newGroupQuaternion); // <--- Modifié ici

            selectedObject.updateHelper();
        }

        this.calculateBounds();
    });

    readonly scene: THREE.Scene;
    objectCount: number = 0;

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
        this.objectCount = this._selection.size;
        if (this.objectCount === 0) {
            this._boundingBox = null;
            this.position.set(0, 0, 0, false);
            return;
        }
        // TODO perhaps do that quicker
        this._boundingBox = new THREE.Box3();
        const tempGroup = new THREE.Group();
        this._selection.forEach(selected => tempGroup.add(selected.object.clone()));
        this._boundingBox.setFromObject(tempGroup);
        tempGroup.clear();
        let center = new THREE.Vector3;
        this._boundingBox.getCenter(center);
        this.position.set(center.x, center.y, center.z, false);
        let size = new THREE.Vector3;
        this._boundingBox.getSize(size)
        this.size.set(size.x, size.y, size.z, false);

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
        const firstSelected = this._selection.values().next().value as THREE.Mesh | undefined;
        if (firstSelected?.material && (firstSelected.material as any).color) {
            return `#${((firstSelected.material as any).color as THREE.Color).getHexString()}`;
        }
        return '#ffffff';
    }

    set color(hexColor: string) {
        const newColor = new THREE.Color(hexColor);
        this._selection.forEach(selected => {
            const mesh = selected.object as THREE.Mesh;
            if (mesh.material && (mesh.material as any).color) {
                ((mesh.material as any).color as THREE.Color).copy(newColor);
            }
        });
        this.color = hexColor;
    }

    newSelectionWith(object: THREE.Object3D): EditorSelection {
        if (!this._selection.has(object)) {
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
        return this;
    }

    newSelectionWithout(object: THREE.Object3D): EditorSelection {
        const selectedObj = this._selection.get(object);
        if (selectedObj) {
            let newSelection = new EditorSelection(this.scene);
            for (let [key, value] of this._selection) {
                if (key != object) {
                    value.editorSelection = newSelection;
                    newSelection._selection.set(key, value);
                }
            }
            newSelection.calculateBounds();
            return newSelection;
        }
        return this; // Return the current instance
    }

    toggle(object: THREE.Object3D): EditorSelection {
        if (this._selection.has(object)) {
            return this.newSelectionWithout(object);
        } else {
            return this.newSelectionWith(object);
        }
    }

    updateHelpers() {
        for (let object of this._selection.values()) {
            object.updateHelper();
        }
    }

    dispose(): void {
        for (let object of this._selection.values()) {
            if (object.editorSelection == this) object.dispose();
        }

    }
}


export default function threeEditor({ scene, container, camera, renderer, gui, controls }: SceneContext): SceneInitResult | void {
    const initialCubeGeometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    const initialCube = new THREE.Mesh(initialCubeGeometry, material);
    scene.add(initialCube);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const mouseDownPosition = new THREE.Vector2();

    // Signal holds a single instance of EditorSelection
    const [editorSelection, _setEditorSelection] = createSignal<EditorSelection>(EditorSelection.createEmpty(scene));

    function setEditorSelection(newSelection: EditorSelection) {
        let currentSelection = editorSelection();
        if (newSelection != currentSelection) {
            currentSelection?.dispose()
            _setEditorSelection(newSelection);
        }
    }

    const [selectedPrimitiveType, setSelectedPrimitiveType] = createSignal<keyof typeof simpleGeometries>('Box');

    let selectedObjectFolder: any | null = null;


    function addPrimitive(primitiveType: keyof typeof simpleGeometries) {
        const GeometryConstructor = simpleGeometries[primitiveType];
        const params = geometryParameters[primitiveType] || [];
        let geometry;

        try {
            if (primitiveType === 'Tube' && params[0] instanceof THREE.Curve) {
                geometry = new GeometryConstructor(params[0] as any, params[1], params[2], params[3], params[4]);
            } else {
                geometry = new GeometryConstructor(...params);
            }
        } catch (error) {
            console.error(`Error creating geometry for ${primitiveType}:`, error);
            geometry = new THREE.BoxGeometry();
        }

        const newMesh = new THREE.Mesh(geometry, material.clone());
        newMesh.position.x = Math.random() * 4 - 2;
        newMesh.position.y = Math.random() * 4 - 2;
        newMesh.position.z = Math.random() * 4 - 2;
        scene.add(newMesh);
    }

    function deleteSelectedObjects() {
        const currentSelection = editorSelection();
        if (currentSelection) {
            // Get the objects to delete before clearing the selection state
            const objectsToDelete = Array.from(currentSelection.objects);

            // Now remove the original objects from the scene and dispose their geometry/material
            objectsToDelete.forEach(obj => {
                scene.remove(obj);
                if ((obj as THREE.Mesh).geometry) {
                    ((obj as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
                }
                if ((obj as THREE.Mesh).material) {
                    if (Array.isArray(((obj as THREE.Mesh).material))) {
                        (((obj as THREE.Mesh).material) as THREE.Material[]).forEach(mat => mat.dispose());
                    } else {
                        (((obj as THREE.Mesh).material) as THREE.Material).dispose();
                    }
                }
            });

            // Notify Solid.js that the selection state has changed
            setEditorSelection(EditorSelection.createEmpty(scene));

        }
    }

    function onMouseDown(event: MouseEvent) {
        if (event.button === 0) {
            mouseDownPosition.x = event.clientX;
            mouseDownPosition.y = event.clientY;
        }
    }

    function onMouseUp(event: MouseEvent) {
        if (event.button === 0) {
            const mouseUpPosition = new THREE.Vector2(event.clientX, event.clientY);
            const moveThreshold = 5;

            if (mouseUpPosition.distanceTo(mouseDownPosition) < moveThreshold) {
                mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
                mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

                raycaster.setFromCamera(mouse, camera);

                const selectableObjects = scene.children.filter(obj =>
                    obj instanceof THREE.Mesh && !(obj instanceof THREE.BoxHelper)
                );

                const intersects = raycaster.intersectObjects(selectableObjects, false);

                const currentSelection = editorSelection();


                if (intersects.length > 0) {
                    const firstIntersectedObject = intersects[0].object;

                    if (event.shiftKey) {
                        setEditorSelection(currentSelection.newSelectionWith(firstIntersectedObject));
                    } else if (event.ctrlKey || event.metaKey) {
                        setEditorSelection(currentSelection.toggle(firstIntersectedObject));
                    } else {
                        const currentlySelectedObject = currentSelection.objectCount === 1 ? currentSelection.objects.next().value : null;
                        const isCurrentlySelectedObjectIntersected = currentlySelectedObject !== null &&
                            intersects.some(intersect => intersect.object === currentlySelectedObject);


                        if (isCurrentlySelectedObjectIntersected) {
                            const currentIndex = intersects.findIndex(intersect => intersect.object === currentlySelectedObject);
                            let nextObject = null;

                            if (currentIndex !== -1) {
                                const nextIndex = (currentIndex + 1) % intersects.length;
                                nextObject = intersects[nextIndex].object;
                            }
                            setEditorSelection(EditorSelection.fromObject(scene, nextObject));

                        } else {
                            setEditorSelection(EditorSelection.fromObject(scene, firstIntersectedObject));
                        }
                    }
                } else {
                    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
                        setEditorSelection(EditorSelection.createEmpty(scene));
                    }
                }

            }
        }
    }

    container.addEventListener('mousedown', onMouseDown, false);
    container.addEventListener('mouseup', onMouseUp, false);

    function GameUIComponent() {
        createEffect(() => {
            const currentSelection = editorSelection();

            if (selectedObjectFolder) {
                selectedObjectFolder.destroy();
                selectedObjectFolder = null;
            }

            if (currentSelection && currentSelection.objectCount > 0) {
                selectedObjectFolder = gui.addFolder(`Selected Objects (${currentSelection.size})`);

                const positionFolder = selectedObjectFolder.addFolder('Position');
                positionFolder.add(currentSelection.position, 'x', -10, 10, 0.01);
                positionFolder.add(currentSelection.position, 'y', -10, 10, 0.01);
                positionFolder.add(currentSelection.position, 'z', -10, 10, 0.01);

                const rotationFolder = selectedObjectFolder.addFolder('Rotation (Euler)');
                rotationFolder.add(currentSelection.rotation, 'x', -Math.PI, Math.PI, 0.01).name('x (rad)');
                rotationFolder.add(currentSelection.rotation, 'y', -Math.PI, Math.PI, 0.01).name('y (rad)');
                rotationFolder.add(currentSelection.rotation, 'z', -Math.PI, Math.PI, 0.01).name('z (rad)');

                const scaleFolder = selectedObjectFolder.addFolder('Scale');
                scaleFolder.add(currentSelection.size, 'x', 0.1, 5, 0.01).name('x');
                scaleFolder.add(currentSelection.size, 'y', 0.1, 5, 0.01).name('y');
                scaleFolder.add(currentSelection.size, 'z', 0.1, 5, 0.01).name('z');

                selectedObjectFolder.addColor(currentSelection, 'color').name('Color');

                selectedObjectFolder.open();
            }
            // Update helpers for all selected objects (they update automatically but calling update is safe)
            if (currentSelection) {
                currentSelection.updateHelpers();
            }
        });

        const [activeTool, setActiveTool] = createSignal<ActiveTool>('select');

        function UIButton(btnProps: { content: string, selected: boolean, size?: number, onclick: (() => void) }) {
            return <button class={"ui-button" + (btnProps.selected ? " selected" : "")}
                onclick={_ => btnProps.onclick()} style={`font-size:${btnProps.size}px`}>
                {btnProps.content}
            </button >;
        }
        function ToolButton(toolProps: { tool: ActiveTool, content: string, size?: number, onclick?: (() => void) }) {
            return <UIButton
                content={toolProps.content}
                selected={activeTool() === toolProps.tool}
                size={toolProps.size}
                onclick={() => {
                    setActiveTool(toolProps.tool);
                    if (toolProps.onclick) {
                        toolProps.onclick();
                    }
                }} />;
        }

        return (
            <div class="ui-root" style="position:absolute; top:0; left:0; height:100vh; color:white;" >
                <div id="title-bar">
                    <div class="title-bar-center-items title-bar-items">
                        Three.js Code Generator
                    </div>
                    <div class="title-bar-right-items title-bar-items">
                        b
                    </div>
                </div>
                <div id="ui-toolbar" class="container">
                    <select
                        value={selectedPrimitiveType()}
                        onchange={(e) => setSelectedPrimitiveType(e.target.value as keyof typeof simpleGeometries)}
                        style="margin-right: 10px; padding: 5px; font-size: 16px; color: black;"
                    >
                        {Object.keys(simpleGeometries).map(key => (
                            <option value={key}>{key}</option>
                        ))}
                    </select>
                    <ToolButton tool="select" content="+" size={40} onclick={() => addPrimitive(selectedPrimitiveType())} />
                    <ToolButton tool="bulldoze" content="🗑️" size={40} onclick={deleteSelectedObjects} />
                </div>
                <div id="instructions">
                    SELECT - Left Click (click repeatedly on selected to cycle, Shift+Click to add, Ctrl/Cmd+Click to toggle)<br />
                    PAN - Right Mouse<br />
                    ZOOM - Scroll<br />
                    ROTATE - Middle Mouse<br />
                </div>
            </div>
        );
    }
    controls.mouseButtons = {
        LEFT: undefined,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN
    };
    render(() => <GameUIComponent />, container);

    return {
        animate: () => {
        },
    };
}
