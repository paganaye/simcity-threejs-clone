import * as THREE from "three";
import { SceneContext, SceneInitResult } from "../..";
import { render } from "solid-js/web";
import { createSignal, createEffect } from "solid-js";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // Import OrbitControls

import "./ThreeEditor.css";

export type ActiveTool = "select" | "bulldoze" | "residential" | "commercial" | "industrial" | "road" | "power-plant" | "power-line";

// Define the list of simple geometries
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
    'Tube': THREE.TubeGeometry, // Note: TubeGeometry requires a path, will use a simple default one
};

// Default parameters for simple geometries (can be expanded)
const geometryParameters: { [key: string]: any[] } = {
    'Box': [1, 1, 1],
    'Sphere': [0.5, 32, 16], // radius, widthSegments, heightSegments
    'Cylinder': [0.5, 0.5, 1, 32], // radiusTop, radiusBottom, height, radialSegments
    'Cone': [0.5, 1, 32], // radius, height, radialSegments
    'Torus': [0.5, 0.2, 16, 100], // radius, tube, radialSegments, tubularSegments
    'Plane': [1, 1], // width, height
    'Circle': [0.5, 32], // radius, segments
    'Ring': [0.2, 0.5, 32], // innerRadius, outerRadius, thetaSegments
    'Tetrahedron': [1], // radius
    'Octahedron': [1], // radius
    'Icosahedron': [1], // radius
    'Dodecahedron': [1], // radius
    'Capsule': [0.5, 1, 4, 8], // radius, length, capSegments, radialSegments
    'Tube': [new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1, -1, 0),
        new THREE.Vector3(-0.5, 0.5, 0),
        new THREE.Vector3(0.5, -0.5, 0),
        new THREE.Vector3(1, 1, 0)
    ]), 0.2, 8, 6, false], // path, tubularSegments, radius, radialSegments, closed
};


export default function threeEditor({ scene, container, camera, renderer, gui, controls }: SceneContext): SceneInitResult | void {
    const initialCubeGeometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    const initialCube = new THREE.Mesh(initialCubeGeometry, material);
    scene.add(initialCube);


    // Configure mouse buttons for OrbitControls based on user request
    controls.enableDamping = true; // An animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2; // Limit vertical rotation
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.LEFT, // Left mouse is for selection, not OrbitControls
        MIDDLE: THREE.MOUSE.ROTATE, // Middle mouse for rotate
        RIGHT: THREE.MOUSE.PAN // Right mouse for pan
    };


    // Raycaster for object selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Signal to hold the selected object
    const [selectedObject, setSelectedObject] = createSignal<THREE.Object3D | null>(null);
    // Signal to hold the selected primitive type from the dropdown
    const [selectedPrimitiveType, setSelectedPrimitiveType] = createSignal<keyof typeof simpleGeometries>('Box');

    // Variable to hold the BoxHelper for the selected object
    let selectionHelper: THREE.BoxHelper | null = null;


    // GUI controls for selected object
    let selectedObjectFolder: any | null = null; // dat.gui folder for the selected object
    let materialColor: THREE.Color = new THREE.Color(); // To hold the color for the GUI


    function addPrimitive(primitiveType: keyof typeof simpleGeometries) {
        const GeometryConstructor = simpleGeometries[primitiveType];
        const params = geometryParameters[primitiveType] || []; // Get parameters, default to empty array if none
        let geometry;

        try {
            // Handle TubeGeometry which requires a curve instance
            if (primitiveType === 'Tube' && params[0] instanceof THREE.Curve) {
                geometry = new GeometryConstructor(params[0], params[1], params[2], params[3], params[4]);
            } else {
                geometry = new GeometryConstructor(...params);
            }
        } catch (error) {
            console.error(`Error creating geometry for ${primitiveType}:`, error);
            // Fallback to BoxGeometry or handle error appropriately
            geometry = new THREE.BoxGeometry();
        }


        const newMesh = new THREE.Mesh(geometry, material.clone()); // Clone material for unique colors
        // Position the new mesh randomly
        newMesh.position.x = Math.random() * 4 - 2;
        newMesh.position.y = Math.random() * 4 - 2;
        newMesh.position.z = Math.random() * 4 - 2;
        scene.add(newMesh);
    }

    // Function to delete the selected object
    function deleteSelectedObject() {
        const obj = selectedObject();
        if (obj) {
            scene.remove(obj); // Remove the object from the scene
            // Dispose of geometry and material to free up memory (important for many objects)
            if ((obj as THREE.Mesh).geometry) {
                ((obj as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
            }
            if ((obj as THREE.Mesh).material) {
                // If material is an array of materials
                if (Array.isArray(((obj as THREE.Mesh).material))) {
                    (((obj as THREE.Mesh).material) as THREE.Material[]).forEach(mat => mat.dispose());
                } else {
                    (((obj as THREE.Mesh).material) as THREE.Material).dispose();
                }
            }
            setSelectedObject(null); // Clear the selection, which will also remove the helper and GUI folder
        }
    }

    // Handle mouse clicks for selection - ONLY process left clicks
    function onMouseDown(event: MouseEvent) {
        // Only process left mouse button clicks (button 0) for selection
        if (event.button === 0) {
            // Calculate mouse position in normalized device coordinates (-1 to +1)
            mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
            mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

            // Update the raycaster
            raycaster.setFromCamera(mouse, camera);

            // Filter out helper objects from the scene children before intersecting
            const selectableObjects = scene.children.filter(obj =>
                obj instanceof THREE.Mesh && !(obj instanceof THREE.BoxHelper)
                // Add other helper types here if needed, e.g., && !(obj instanceof THREE.AxesHelper)
            );


            // Find intersecting objects from the filtered list
            const intersects = raycaster.intersectObjects(selectableObjects, false);

            if (intersects.length > 0) {
                // Get the first intersected object
                const intersectedObject = intersects[0].object;
                // Set the selected object signal
                setSelectedObject(intersectedObject);
            } else {
                // No object intersected, clear the selection
                setSelectedObject(null);
            }
        }
    }

    // Add event listener to the container
    container.addEventListener('mousedown', onMouseDown, false);


    function GameUIComponent(props: {}) {
        // Effect to update GUI and selection helper based on selected object
        createEffect(() => {
            const obj = selectedObject();

            // Remove previous selected object controls using destroy()
            if (selectedObjectFolder) {
                selectedObjectFolder.destroy();
                selectedObjectFolder = null; // Reset the reference
            }

            // Remove previous selection helper
            if (selectionHelper) {
                scene.remove(selectionHelper);
                selectionHelper = null; // Reset the reference
            }


            if (obj) {
                // Create a new folder for the selected object in the GUI
                selectedObjectFolder = gui.addFolder('Selected Object: ' + obj.uuid.substring(0, 6) + ' ' + obj.constructor.name);

                // Position controls
                const positionFolder = selectedObjectFolder.addFolder('Position');
                positionFolder.add(obj.position, 'x', -10, 10, 0.01);
                positionFolder.add(obj.position, 'y', -10, 10, 0.01);
                positionFolder.add(obj.position, 'z', -10, 10, 0.01);

                // Rotation controls (using Euler angles for simplicity with GUI)
                const rotationFolder = selectedObjectFolder.addFolder('Rotation (Euler)');
                rotationFolder.add(obj.rotation, 'x', -Math.PI, Math.PI, 0.01).name('x (rad)');
                rotationFolder.add(obj.rotation, 'y', -Math.PI, Math.PI, 0.01).name('y (rad)');
                rotationFolder.add(obj.rotation, 'z', -Math.PI, Math.PI, 0.01).name('z (rad)');

                // Scale controls
                const scaleFolder = selectedObjectFolder.addFolder('Scale');
                scaleFolder.add(obj.scale, 'x', 0.1, 5, 0.01);
                scaleFolder.add(obj.scale, 'y', 0.1, 5, 0.01);
                scaleFolder.add(obj.scale, 'z', 0.1, 5, 0.01);

                // Color control (only for MeshStandardMaterial or similar with a color property)
                if ((obj as THREE.Mesh).material && ((obj as THREE.Mesh).material as any).color) {
                    materialColor.copy(((obj as THREE.Mesh).material as any).color); // Copy color to our helper object
                    const colorControl = selectedObjectFolder.addColor(materialColor, 'getHex').name('Color').onChange(function (hexColor: number) {
                        ((obj as THREE.Mesh).material as any).color.setHex(hexColor);
                    });
                }

                selectedObjectFolder.open(); // Open the folder by default

                // Create and add a BoxHelper for the selected object
                selectionHelper = new THREE.BoxHelper(obj, 0xffff00); // Yellow color for the helper
                scene.add(selectionHelper);

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
                    {/* Dropdown for selecting primitive type */}
                    <select
                        value={selectedPrimitiveType()}
                        onchange={(e) => setSelectedPrimitiveType(e.target.value as keyof typeof simpleGeometries)}
                        style="margin-right: 10px; padding: 5px; font-size: 16px; color: black;" // Basic styling
                    >
                        {Object.keys(simpleGeometries).map(key => (
                            <option value={key}>{key}</option>
                        ))}
                    </select>
                    {/* Button to add the selected primitive */}
                    <ToolButton tool="select" content="+" size={40} onclick={() => addPrimitive(selectedPrimitiveType())} />
                    {/* Button to delete the selected object */}
                    <ToolButton tool="bulldoze" content="🗑️" size={40} onclick={deleteSelectedObject} />
                </div>
                <div id="instructions">
                    SELECT - Left Mouse<br />
                    PAN - Right Mouse<br />
                    ZOOM - Scroll<br />
                    ROTATE - Middle Mouse<br />
                </div>
            </div>
        );
    }

    render(() => <GameUIComponent />, container);


    return {
        animate: () => {
            // Update OrbitControls in the animation loop is done somewhere else
        },
        // SceneInitResult n'a pas encore de dispose
        //  dispose: () => {
        //     container.removeEventListener('mousedown', onMouseDown, false);
        //     if (selectedObjectFolder) {
        //          selectedObjectFolder.destroy(); // Use destroy() to clean up the GUI folder
        //     }
        //     if (selectionHelper) {
        //         scene.remove(selectionHelper);
        //     }
        //     controls.dispose(); // Dispose of OrbitControls
        // }
    };

}
