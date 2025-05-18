import * as THREE from "three";
import { Accessor, createSignal, Setter } from "solid-js";

import { EditorSelection, simpleGeometries, geometryParameters } from "./editorSelection";

import "./ThreeEditor.css";
import { Page } from "../Page";
import { setupEditorUI } from "./editorUI";



export default class ThreeEditor extends Page {
    readonly editorSelection!: Accessor<EditorSelection>;
    private readonly _setEditorSelection!: Setter<EditorSelection>;
    readonly selectedPrimitiveType!: Accessor<keyof typeof simpleGeometries>;
    readonly setSelectedPrimitiveType!: Setter<keyof typeof simpleGeometries>;

    initialCubeGeometry = new THREE.BoxGeometry();
    material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });


    constructor() {
        super();
        [this.editorSelection, this._setEditorSelection] = createSignal<EditorSelection>(EditorSelection.createEmpty(this.scene));
        [this.selectedPrimitiveType, this.setSelectedPrimitiveType] = createSignal<keyof typeof simpleGeometries>('Box');

    }


    setEditorSelection(newSelection: EditorSelection) {
        const currentSelection = this.editorSelection();
        if (newSelection !== currentSelection) {
            currentSelection?.dispose();
            this._setEditorSelection(newSelection);
        }
    }

    run(): Promise<void> | void {
        let initialCube = new THREE.Mesh(this.initialCubeGeometry, this.material);

        initialCube.position.set(0, 0, 0);
        this.scene.add(initialCube);

        const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), sphereMaterial);
        sphere.position.set(2, 1, 0);
        this.scene.add(sphere);

        const cylinderMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
        const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 32), cylinderMaterial);
        cylinder.position.set(-2, 0.5, 0);
        this.scene.add(cylinder);



        setupEditorUI(this)


        this.controls!.mouseButtons = {
            LEFT: undefined,
            MIDDLE: THREE.MOUSE.ROTATE,
            RIGHT: THREE.MOUSE.PAN
        };

    }

    override loop(_elapsed: number): void {

    }

    addPrimitive(primitiveType: keyof typeof simpleGeometries) {
        const GeometryConstructor = simpleGeometries[primitiveType];
        const params = geometryParameters[primitiveType] || [];
        let geometry;

        try {
            if (primitiveType === 'Tube' && params[0] instanceof THREE.Curve) {
                geometry = new GeometryConstructor(params[0] as any, params[1], params[2], params[3], params[4]);
            } else {
                geometry = new (GeometryConstructor as any)(...params);
            }
        } catch (error) {
            console.error(`Error creating geometry for ${primitiveType}:`, error);
            geometry = new THREE.BoxGeometry();
        }

        const newMesh = new THREE.Mesh(geometry, this.material.clone());
        newMesh.position.x = Math.random() * 4 - 2;
        newMesh.position.y = Math.random() * 2;
        newMesh.position.z = Math.random() * 4 - 2;

        this.scene.add(newMesh);
    }


    deleteSelectedObjects() {
        const currentSelection = this.editorSelection();
        if (currentSelection && currentSelection.objectCount > 0) {
            const objectsToDelete = Array.from(currentSelection.objects);

            objectsToDelete.forEach((obj: any) => {
                this.scene.remove(obj);
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

            this.setEditorSelection(EditorSelection.createEmpty(this.scene));
        }
    }


}