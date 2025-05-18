import * as THREE from "three";
import { render } from "solid-js/web";
import { createSignal, createEffect, Accessor, Setter, JSX } from "solid-js";
import { GUI } from 'lil-gui';

import { EditorSelection, ActiveTool, simpleGeometries } from "./editorSelection";

import "./ThreeEditor.css";
import ThreeEditor from "./ThreeEditor";



export function setupEditorUI(page: ThreeEditor): void {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const mouseDownPosition = new THREE.Vector2();


    page.appContainer.addEventListener('mousedown', onContainerMouseDown, false);
    page.appContainer.addEventListener('mouseup', onContainerMouseUp, false);
    window.addEventListener('keydown', onKeyDown, false); // Add keyboard listener to window

    function onContainerMouseDown(event: MouseEvent) {
        if (event.button === 0) {
            mouseDownPosition.x = event.clientX;
            mouseDownPosition.y = event.clientY;
        }
    }

    function onContainerMouseUp(event: MouseEvent) {
        if (event.button === 0) {
            const mouseUpPosition = new THREE.Vector2(event.clientX, event.clientY);
            const moveThreshold = 5;

            if (mouseUpPosition.distanceTo(mouseDownPosition) < moveThreshold) {
                mouse.x = (event.clientX / page.renderer.domElement.clientWidth) * 2 - 1;
                mouse.y = -(event.clientY / page.renderer.domElement.clientHeight) * 2 + 1;

                raycaster.setFromCamera(mouse, page.camera);

                const selectableObjects = page.scene.children.filter(obj =>
                    obj instanceof THREE.Mesh && !(obj instanceof THREE.BoxHelper) && obj.userData.isSelectable !== false
                );

                const intersects = raycaster.intersectObjects(selectableObjects, true);

                const currentSelection = page.editorSelection();


                if (intersects.length > 0) {
                    const firstIntersectedObject = intersects[0].object;

                    if (event.shiftKey) {
                        page.setEditorSelection(currentSelection.newSelectionWith(firstIntersectedObject));
                    } else if (event.ctrlKey || event.metaKey) {
                        page.setEditorSelection(currentSelection.toggle(firstIntersectedObject));
                    } else {
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
                } else {
                    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
                        page.setEditorSelection(EditorSelection.createEmpty(page.scene));
                    }
                }
            }
        }
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


    function UIButton(btnProps: { content: string, selected: boolean, size?: number, onclick: (() => void) }): JSX.Element {
        return (
            <button
                class={"ui-button" + (btnProps.selected ? " selected" : "")}
                onclick={() => btnProps.onclick()}
                style={`font-size:${btnProps.size}px`}
            >
                {btnProps.content}
            </button>
        );
    }

    function ToolButton(toolProps: { tool: ActiveTool, content: string, size?: number, onclick?: (() => void), activeToolSignal: Accessor<ActiveTool>, setActiveTool: Setter<ActiveTool> }): JSX.Element {
        return (
            <UIButton
                content={toolProps.content}
                selected={toolProps.activeToolSignal() === toolProps.tool}
                size={toolProps.size}
                onclick={() => {
                    toolProps.setActiveTool(toolProps.tool);
                    if (toolProps.onclick) {
                        toolProps.onclick();
                    }
                }}
            />
        );
    }

    function GameUIComponent(props: {
        page: ThreeEditor
    }) {
        const [activeTool, setActiveTool] = createSignal<ActiveTool>('select');

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
                    <ToolButton tool="select" content="Select" size={16} activeToolSignal={activeTool} setActiveTool={() => setActiveTool} />
                    <ToolButton tool="residential" content="Add" size={16} activeToolSignal={activeTool} setActiveTool={() => setActiveTool} onclick={() => props.page.addPrimitive(props.page.selectedPrimitiveType())} />
                    <ToolButton tool="bulldoze" content="Delete" size={16} activeToolSignal={activeTool} setActiveTool={() => setActiveTool} onclick={() => props.page.deleteSelectedObjects()} />
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