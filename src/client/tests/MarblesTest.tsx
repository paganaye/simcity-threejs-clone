import * as THREE from "three";
import { vert, frag } from "../../utils/glsl";
import { random, randomize } from "../../sim/Rng";
import { GUI } from 'lil-gui';
import { Page } from "../Page";

let totalPopulation: number = 10_000;
let instancedMeshes: THREE.InstancedMesh[] = [];
const WORLD_SIZE: number = 100;
const GRID_SIZE: number = 3;
const NUM_GRID_MESHES: number = GRID_SIZE * GRID_SIZE * GRID_SIZE;

const meshVisibilityStates: Record<string, boolean> = {}; // Corrected typage
let meshGuiFolder: GUI | undefined; // GUI might not be available initially

const ParallelBillboardVertexShader = vert`
    // Attribute provided by InstancedMesh
    attribute vec3 instanceColor; // Declare instanceColor as an attribute

    varying vec2 vUv;
    varying vec3 vInstanceColor;
    varying float vInstanceCameraDepth;

    void main() {
        vUv = uv;
        // Use the instanceColor attribute for the varying color
        vInstanceColor = instanceColor; // Now each instance will have its own color

        vec4 instanceCameraPosition = viewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vInstanceCameraDepth = instanceCameraPosition.z;
        vec4 vertexCameraPosition = instanceCameraPosition + vec4(position.xyz, 0.0);
        gl_Position = projectionMatrix * vertexCameraPosition;
    }
`;

const fragmentShaderCode = frag`
    precision highp float;

    #define PI 3.14159 // Correction de la valeur PI, 57... est beaucoup trop grand
    #define PI_DIV_2 1.5707963267948966

    varying vec2 vUv;
    varying vec3 vInstanceColor;
    varying float vInstanceCameraDepth;

    uniform float uRadius;
    uniform vec2 uCenter;
    uniform float uTime;
    uniform vec3 uLightDirection;
    uniform bool uUseFragDepth;
    uniform float uCameraNear;
    uniform float uCameraFar;
    uniform mat4 projectionMatrix; // <-- Déclare la matrice de projection comme un uniforme

    // ... (le reste des fonctions et de la fonction main) ...
    float rgbToHue(vec3 color) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec3 p = abs(fract(color.xxx + K.xyz) * 6.0 - K.www);
        return mix(K.x, K.z, p.x);
    }

    vec3 hsv2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod((c.x * 6.0 + vec3(0.0, 4.0, 2.0)), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return c.z * mix(vec3(1.0), rgb, c.y);
    }

    void main() {
        float dist = distance(vUv, uCenter);

        if (dist < uRadius) {
            vec2 xy_from_center = (vUv - uCenter) / uRadius;
            float z_sphere_sq = 1.0 - dot(xy_from_center, xy_from_center);

            if (z_sphere_sq > 0.0) {
                float z_sphere = sqrt(z_sphere_sq);

                if (uUseFragDepth) {

                    // Ton calcul de "trueCameraSpaceZ" (basé sur cos)
                    // Note : Comme discuté, ce n'est pas le vrai Z spatial d'une sphère normale
                    float trueCameraSpaceZ_for_projection = -2.5 -  vInstanceCameraDepth + cos(z_sphere * PI_DIV_2)/2.0; // Renommé pour clarté

                    // Calcul des composantes clip Z et W en utilisant la projectionMatrix
                    // Note : Ceci projette un point (0,0,Z,1) si les composants X,Y sont 0 dans le calcul clip Z/W
                    float valeur_clip_z = trueCameraSpaceZ_for_projection * projectionMatrix[2][2] + projectionMatrix[2][3];
                    float valeur_clip_w = trueCameraSpaceZ_for_projection * projectionMatrix[3][2] + projectionMatrix[3][3];

                    gl_FragDepth = valeur_clip_z / valeur_clip_w;


                    // Visualisation (utilise toujours l'ancienne variable 'depth', qui n'est plus calculée ici)
                    // Il faudrait peut-être baser la visualisation sur trueCameraSpaceZ_for_projection ou normalizedDepth
                    // pc_fragColor = vec4(hsv2rgb(vec3(depth/2.0, 1.0, 1.0)), 1); // 'depth' est indéfini ici
                    // Exemple : Visualisation basée sur trueCameraSpaceZ_for_projection
                    // float vis_depth = trueCameraSpaceZ_for_projection; // Utilise la valeur calculée pour gl_FragDepth
                    // pc_fragColor = vec4(hsv2rgb(vec3(vis_depth/6.0, 1.0, 1.0)), 1.0); // Ajuster le facteur 6.0

                }
                // Ton else { ... } a été commenté, il faut le remettre
                //else
                {
                    // Logique standard quand gl_FragDepth n'est pas utilisé
                    vec3 pseudoNormal = normalize(vec3(xy_from_center.x, xy_from_center.y, z_sphere));
                    vec3 baseColor = vInstanceColor;
                    float ambientIntensity = 0.3;
                    float diffuseLighting = max(0.0, dot(pseudoNormal, uLightDirection));
                    vec3 litColor = baseColor * (ambientIntensity + diffuseLighting);
                    pc_fragColor = vec4(litColor, 1.0);
                }
            } else {
                discard;
            }
        } else {
            discard;
        }
    }
`;



export default class MarblesTest extends Page {
    readonly planeSize: number = 2;
    readonly planeGeometry = new THREE.PlaneGeometry(this.planeSize, this.planeSize, 1, 1);
    instancePositions!: Float32Array;
    instanceSizes!: Float32Array;
    instanceColors!: Float32Array;
    standardMaterial = new THREE.MeshStandardMaterial();
    shaderMaterial!: THREE.ShaderMaterial;

    addCube(): void {
        const cubeGeometry = new THREE.BoxGeometry(.1, 20, .1);
        const cube = new THREE.Mesh(cubeGeometry, this.standardMaterial);
        this.scene.add(cube);
    }

    async run() {

        this.addCube();


        // Initial attribute arrays (will be replaced if totalPopulation changes)
        this.instancePositions = new Float32Array(totalPopulation * 3);
        this.instanceSizes = new Float32Array(totalPopulation * 3); // Not currently used in shader
        this.instanceColors = new Float32Array(totalPopulation * 3); // This will now be populated and used

        // Set initial attributes on the geometry
        this.planeGeometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(this.instancePositions, 3));
        this.planeGeometry.setAttribute('instanceSize', new THREE.InstancedBufferAttribute(this.instanceSizes, 3));
        this.planeGeometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(this.instanceColors, 3));

        const sharedUniforms = {
            uRadius: { value: 0.45 },
            uTime: { value: 0.0 },
            uCenter: { value: new THREE.Vector2(0.5, 0.5) },
            uLightDirection: { value: new THREE.Vector3(0.5, 0.5, 0.7).normalize() },
            uCameraPosition: { value: this.camera.position }, // Kept, though not used in gl_FragDepth logic
            uUseFragDepth: { value: true },
            uCameraNear: { value: this.camera.near },
            uCameraFar: { value: this.camera.far },
            projectionMatrix: { value: this.camera.projectionMatrix }, // <-- Ajoute la matrice de projection
        };


        // Create the shared material once
        this.shaderMaterial = new THREE.ShaderMaterial({
            vertexShader: ParallelBillboardVertexShader,
            fragmentShader: fragmentShaderCode,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: true,
            uniforms: sharedUniforms
        });


        const logMin: number = Math.log10(1);
        const logMax: number = Math.log10(1_000_000);
        let logTotalPopulation: number = Math.log10(totalPopulation);



        // Initial creation of the instanced meshes when the scene is set up
        this.createInstancedMeshes();


        if (this.gui) {
            this.gui.add({ logTotalPopulation }, 'logTotalPopulation')
                .name('Total Population (Log 10)')
                .min(logMin)
                .max(logMax)
                .step((logMax - logMin) / 10)
                .onChange(this.createInstancedMeshes) // Recreate meshes when population changes
                .listen(); // Keep GUI value updated if population changes programmatically
            this.gui.add(sharedUniforms.uUseFragDepth, 'value').name('Use gl_FragDepth');
        }

    }

    createInstancedMeshes(popLog?: number): void {
        // Dispose of existing meshes and remove from scene
        if (instancedMeshes.length > 0) {
            instancedMeshes.forEach(mesh => {
                this.scene.remove(mesh);
                // Geometry and Material are shared, don't dispose here
            });
            instancedMeshes = [];
        }

        if (popLog !== undefined) {
            totalPopulation = Math.round(Math.pow(10, popLog));
            if (totalPopulation < NUM_GRID_MESHES) {
                totalPopulation = NUM_GRID_MESHES;
            }
        }

        // If total population changed, we need new attribute buffers
        if (this.planeGeometry.attributes.instanceColor.count !== totalPopulation) {
            this.instancePositions = new Float32Array(totalPopulation * 3);
            this.instanceSizes = new Float32Array(totalPopulation * 3);
            this.instanceColors = new Float32Array(totalPopulation * 3);

            this.planeGeometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(this.instancePositions, 3));
            this.planeGeometry.setAttribute('instanceSize', new THREE.InstancedBufferAttribute(this.instanceSizes, 3));
            this.planeGeometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(this.instanceColors, 3));
        } else {
            // If population didn't change, reuse existing attribute arrays
            this.instancePositions = this.planeGeometry.attributes.instancePosition.array as Float32Array;
            this.instanceSizes = this.planeGeometry.attributes.instanceSize.array as Float32Array;
            this.instanceColors = this.planeGeometry.attributes.instanceColor.array as Float32Array;
        }


        const instancesPerMesh: number = Math.floor(totalPopulation / NUM_GRID_MESHES);
        let remainingInstances: number = totalPopulation % NUM_GRID_MESHES;

        const tempMatrix = new THREE.Matrix4();
        randomize(1); // Seed the random number generator

        let globalInstanceIndex: number = 0; // Keep track of the global instance index

        for (const key in meshVisibilityStates) {
            delete meshVisibilityStates[key];
        }
        if (meshGuiFolder) {
            meshGuiFolder.destroy();
        }
        if (this.gui) {
            meshGuiFolder = this.gui.addFolder('Mesh Visibility');
            meshGuiFolder.close(); // Close by default if preferred
        }


        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                for (let k = 0; k < GRID_SIZE; k++) {
                    const currentMeshInstanceCount: number = instancesPerMesh + (remainingInstances > 0 ? 1 : 0);
                    if (remainingInstances > 0) remainingInstances--;

                    if (currentMeshInstanceCount === 0) continue;

                    // Create a new InstancedMesh for this grid cell using the shared geometry and material
                    const mesh = new THREE.InstancedMesh(this.planeGeometry, this.shaderMaterial, currentMeshInstanceCount);

                    const cellMinX: number = (i / GRID_SIZE - 0.5) * WORLD_SIZE;
                    const cellMinY: number = (j / GRID_SIZE - 0.5) * WORLD_SIZE;
                    const cellMinZ: number = (k / GRID_SIZE - 0.5) * WORLD_SIZE;
                    const cellSize: number = WORLD_SIZE / GRID_SIZE;

                    for (let l = 0; l < currentMeshInstanceCount; l++) {
                        let x: number = cellMinX + random() * cellSize;
                        let y: number = cellMinY + random() * cellSize;
                        let z: number = cellMinZ + random() * cellSize;

                        tempMatrix.identity().setPosition(x, y, z);
                        mesh.setMatrixAt(l, tempMatrix);

                        // Assign a random color directly to the instanceColors attribute array
                        this.instanceColors[globalInstanceIndex * 3] = random(); // R
                        this.instanceColors[globalInstanceIndex * 3 + 1] = random(); // G
                        this.instanceColors[globalInstanceIndex * 3 + 2] = random(); // B

                        globalInstanceIndex++;
                    }

                    // Mark the instance matrix buffer for update
                    mesh.instanceMatrix.needsUpdate = true;

                    this.scene.add(mesh);
                    instancedMeshes.push(mesh);

                    const meshName: string = `Mesh [${i},${j},${k}]`;
                    meshVisibilityStates[meshName] = true;
                    if (meshGuiFolder) {
                        meshGuiFolder.add(meshVisibilityStates, meshName)
                            .onChange((value: boolean) => {
                                mesh.visible = value;
                            });
                    }
                }
            }
        }

        // Mark the instanceColor attribute buffer for update after populating it
        this.planeGeometry.attributes.instanceColor.needsUpdate = true;


        this.camera.lookAt(0, 0, 0);
    }

    override loop(_elapsedTime: number) {

        // function animate(elapsed: number): void {
        //     sharedUniforms.uTime.value = elapsed;
        //     if (sharedUniforms.uCameraPosition.value && camera.position) {
        //         sharedUniforms.uCameraPosition.value.copy(camera.position);
        //     }
        //     if (sharedUniforms.uCameraNear.value !== camera.near) {
        //         sharedUniforms.uCameraNear.value = camera.near;
        //     }
        //     if (sharedUniforms.uCameraFar.value !== camera.far) {
        //         sharedUniforms.uCameraFar.value = camera.far;
        //     }
        //     const currentAnimatedRadius = 0.5; // Math.abs(Math.sin(sharedUniforms.uTime.value / 20) / 2);
        //     sharedUniforms.uRadius.value = currentAnimatedRadius;
        // }




    }
}

