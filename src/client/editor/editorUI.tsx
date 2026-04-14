import * as THREE from "three";
import { render } from "solid-js/web";
import { createEffect } from "solid-js";
import { GUI } from 'lil-gui';

import { EditorSelection, simpleGeometries } from "./editorSelection";

import "./ThreeEditor.css";
import ThreeEditor from "./ThreeEditor";



export function setupEditorUI(page: ThreeEditor): void {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const mouseDownPosition = new THREE.Vector2();
    const moveThreshold = 5;


    page.appContainer.addEventListener('mousedown', onContainerMouseDown, false);
    page.appContainer.addEventListener('mouseup', onContainerMouseUp, false);
    window.addEventListener('keydown', onKeyDown, false); // Add keyboard listener to window

    function onContainerMouseDown(event: MouseEvent) {
        if (event.button === 0) {
            mouseDownPosition.x = event.clientX;
            mouseDownPosition.y = event.clientY;
        }
    }

    function isClickSelectionGesture(event: MouseEvent): boolean {
        if (event.button !== 0) {
            return false;
        }

        const mouseUpPosition = new THREE.Vector2(event.clientX, event.clientY);
        return mouseUpPosition.distanceTo(mouseDownPosition) < moveThreshold;
    }

    function getSelectableIntersects(event: MouseEvent): THREE.Intersection[] {
        mouse.x = (event.clientX / page.renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(event.clientY / page.renderer.domElement.clientHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, page.camera);

        const selectableRoots = page.scene.children.filter(obj =>
            obj instanceof THREE.Mesh && !(obj instanceof THREE.BoxHelper) && obj.userData.isSelectable !== false
        );

        return raycaster.intersectObjects(selectableRoots, true);
    }

    function selectSingleObjectFromIntersects(
        event: MouseEvent,
        currentSelection: EditorSelection,
        intersects: THREE.Intersection[],
    ): void {
        const firstIntersectedObject = intersects[0]?.object;
        if (!firstIntersectedObject) {
            return;
        }

        if (event.shiftKey) {
            page.setEditorSelection(currentSelection.newSelectionWith(firstIntersectedObject));
            return;
        }

        if (event.ctrlKey || event.metaKey) {
            page.setEditorSelection(currentSelection.toggle(firstIntersectedObject));
            return;
        }

        const currentlySelectedObject = currentSelection.objectCount === 1 ? currentSelection.objects.next().value : null;

        let objectToSelect = firstIntersectedObject;
        if (currentlySelectedObject) {
            const currentIndexInIntersects = intersects.findIndex(intersect => intersect.object === currentlySelectedObject);
            if (currentIndexInIntersects !== -1) {
                const nextIndex = (currentIndexInIntersects + 1) % intersects.length;
                objectToSelect = intersects[nextIndex].object;
            }
        }

        page.setEditorSelection(EditorSelection.fromObject(page.scene, objectToSelect));
    }

    function clearSelectionIfNeeded(event: MouseEvent): void {
        if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
            page.setEditorSelection(EditorSelection.createEmpty(page.scene));
        }
    }

    function onContainerMouseUp(event: MouseEvent) {
        if (!isClickSelectionGesture(event)) {
            return;
        }

        const intersects = getSelectableIntersects(event);
        if (intersects.length === 0) {
            clearSelectionIfNeeded(event);
            return;
        }

        selectSingleObjectFromIntersects(event, page.editorSelection(), intersects);
    }

    function onKeyDown(event: KeyboardEvent) {
        // Check if the target is an input element, to avoid deleting while typing
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
            return;
        }

        // Check for Delete or Backspace keys
        if (event.key === 'Delete' || event.key === 'Backspace') {
            const currentSelection = page.editorSelection();
            if (currentSelection && currentSelection.objectCount > 0) {
                event.preventDefault(); // Prevent default browser action (e.g., navigating back)
                page.deleteSelectedObjects(); // Call the delete function passed from threeEditor.ts
            }
        }
    }


    function GameUIComponent(props: {
        page: ThreeEditor
    }) {

        let selectedObjectFolder: GUI | null = null;



        createEffect(() => {
            let page = props.page;
            const currentSelection = page.editorSelection();

            if (selectedObjectFolder) {
                selectedObjectFolder.destroy();
                selectedObjectFolder = null;
            }

            if (currentSelection && currentSelection.objectCount > 0) {
                selectedObjectFolder = page.gui!.addFolder(`Selected Objects (${currentSelection.objectCount})`);

                const positionFolder = selectedObjectFolder.addFolder('Position');
                positionFolder.add(currentSelection.position, 'x', -10, 10, 0.01);
                positionFolder.add(currentSelection.position, 'y', -10, 10, 0.01);
                positionFolder.add(currentSelection.position, 'z', -10, 10, 0.01);

                const rotationFolder = selectedObjectFolder.addFolder('Rotation (Euler)');
                rotationFolder.add(currentSelection.rotation, 'x', -Math.PI, Math.PI, 0.01).name('x (rad)');
                rotationFolder.add(currentSelection.rotation, 'y', -Math.PI, Math.PI, 0.01).name('y (rad)');
                rotationFolder.add(currentSelection.rotation, 'z', -Math.PI, Math.PI, 0.01).name('z (rad)');

                const scaleFolder = selectedObjectFolder.addFolder('Scale (Group Size)');
                scaleFolder.add(currentSelection.size, 'x', 0.1, 5, 0.01).name('Width');
                scaleFolder.add(currentSelection.size, 'y', 0.1, 5, 0.01).name('Height');
                scaleFolder.add(currentSelection.size, 'z', 0.1, 5, 0.01).name('Depth');

                selectedObjectFolder.addColor(currentSelection, 'color').name('Color');

                selectedObjectFolder.open();
            }
        });

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
                <div id="ui-toolbar" class="container"
                    onmousedown={toolbarMouseDown}
                    onmouseup={toolbarMouseUp}
                >
                    <select
                        value={props.page.selectedPrimitiveType()}
                        onchange={(e) => props.page.setSelectedPrimitiveType(e.target.value as keyof typeof simpleGeometries)}
                        style="margin-right: 10px; padding: 5px; font-size: 16px; color: black;"
                    >
                        {Object.keys(simpleGeometries).map(key => (
                            <option value={key}>{key}</option>
                        ))}
                    </select>
                </div>
                <div id="instructions">
                    SELECT - Left Click (click repeatedly on selected to cycle, Shift+Click to add, Ctrl/Cmd+Click to toggle)<br />
                    PAN - Right Mouse<br />
                    ZOOM - Scroll<br />
                    ROTATE - Middle Mouse<br />
                    DELETE - Delete/Backspace Key
                </div>
            </div>
        );
    }

    function toolbarMouseDown(e: MouseEvent) {
        //   e.preventDefault();
        e.stopPropagation();
    }

    function toolbarMouseUp(e: MouseEvent) {
        // e.preventDefault();
        e.stopPropagation();
    }


    render(() => <GameUIComponent page={page} />, page.appContainer);
}