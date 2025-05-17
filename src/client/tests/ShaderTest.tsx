import * as THREE from "three";
import { vert, frag } from "../../utils/glsl";
import { SceneContext } from "../..";
import { random, randomize } from "../../sim/Rng";
let population = 10_000;
let instancedMesh: THREE.InstancedMesh | null = null;
const WORLD_SIZE = 10;


const PointBillboardVertexShader = vert`
    varying vec2 vUv;
    varying vec3 vInstanceColor;
    varying vec3 vWorldPosition;
    varying vec3 vInstanceCenterWorld;
    varying float vInstanceSize;

    attribute vec3 instancePosition;
    attribute vec3 instanceColor;
    attribute float instanceSize;

    void main() {
        vUv = uv;
        vInstanceColor = instanceColor;
        vInstanceSize = instanceSize;
        vec3 P = instancePosition;
        vec3 C = cameraPosition;
        vec3 lookDir = normalize(C - P);
        vec3 worldUp = vec3(0.0, 1.0, 0.0);
        vec3 billboardRight = normalize(cross(worldUp, lookDir));
        vec3 billboardUp = normalize(cross(lookDir, billboardRight));
        mat3 billboardMatrix = mat3(billboardRight, billboardUp, lookDir);
        vec3 scaledPosition = position * instanceSize;
        vec3 worldPosition = billboardMatrix * scaledPosition + P;
        vWorldPosition = worldPosition;
        vInstanceCenterWorld = P;
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
    }

`;


const ParallelBillboardVertexShader = vert`
    varying vec2 vUv;
    varying vec3 vInstanceColor;
    varying vec3 vWorldPosition;
    varying vec3 vInstanceCenterWorld;
    varying float vInstanceSize;
    attribute vec3 instancePosition;
    attribute vec3 instanceColor;
    attribute float instanceSize;
    uniform mat4 viewMatrixInverse;
    void main() {
        vUv = uv;
        vInstanceColor = instanceColor;
        vInstanceSize = instanceSize;
        vec3 P = instancePosition;
        vec3 cameraForwardWorld = vec3(viewMatrixInverse[0][2], viewMatrixInverse[1][2], viewMatrixInverse[2][2]);
        vec3 newLookDir = cameraForwardWorld;
        vec3 worldUp = vec3(0.0, 1.0, 0.0);
        vec3 billboardRight = normalize(cross(worldUp, newLookDir));
        if (length(billboardRight) < 0.0001) {
            billboardRight = normalize(cross(vec3(1.0, 0.0, 0.0), newLookDir));
        }
        vec3 billboardUp = normalize(cross(newLookDir, billboardRight));
        mat3 billboardMatrix = mat3(billboardRight, billboardUp, newLookDir);
        vec3 scaledPosition = position * vInstanceSize;
        vec3 worldPosition = billboardMatrix * scaledPosition + P;
        vWorldPosition = worldPosition;
        vInstanceCenterWorld = P;
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
    }
`;
const fragmentShaderCode = frag`
    precision highp float;
    varying vec2 vUv;
    varying vec3 vInstanceColor;
    varying vec3 vWorldPosition;
    varying vec3 vInstanceCenterWorld;
    varying float vInstanceSize;
    uniform float uRadius;
    uniform vec2 uCenter;
    uniform float uTime;
    uniform vec3 uLightDirection;
    uniform vec3 uCameraPosition;
    uniform mat4 projectionMatrixInverse;
    uniform mat4 viewMatrixInverse;
    uniform bool uUseFragDepth; // New uniform to control gl_FragDepth usage

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

                if (uUseFragDepth) { // Conditional gl_FragDepth
                    // Calculate depth based on the instance center and the sphere's z-coordinate
                    float depth = distance(uCameraPosition, vInstanceCenterWorld);
                    depth =  depth - z_sphere ; // Adjust depth based on the sphere's surface
                    float near = 0.1; // Should match camera near plane
                    float far = 1000.0; // Should match camera far plane
                    float normalizedDepth = (depth - near) / (far - near);
                    normalizedDepth = clamp(normalizedDepth, 0.0, 1.0);
                    gl_FragDepth = normalizedDepth;
                }

                vec3 pseudoNormal = normalize(vec3(xy_from_center.x, xy_from_center.y, z_sphere));
                // Use normalizedDepth for color if gl_FragDepth is used, otherwise use a default
                vec3 hueColor;
                if (uUseFragDepth) {
                     float depthForColor = distance(uCameraPosition, vWorldPosition); // Use world position for color calculation
                     float near = 0.1;
                     float far = 1000.0;
                     float normalizedDepthForColor = (depthForColor - near) / (far - near);
                     normalizedDepthForColor = clamp(normalizedDepthForColor, 0.0, 1.0);
                     //hueColor = hsv2rgb(vec3(normalizedDepthForColor * 1000.0, 1.0, 1.0));
                    hueColor = vInstanceColor; // Or some other color logic
                } else {
                    // Fallback color calculation if not using gl_FragDepth
                    hueColor = vInstanceColor; // Or some other color logic
                }


                float ambientIntensity = 0.3;
                float diffuseLighting = max(0.0, dot(pseudoNormal, uLightDirection));
                vec3 litColor = hueColor * (ambientIntensity + diffuseLighting); // Use hueColor for lighting
                pc_fragColor = vec4(litColor, 1.0);
            } else {
                discard;
            }
        } else {
            discard;
        }
    }
`;
export default function shaderTest({ scene, camera, gui }: SceneContext) {
    const planeSize = 2;
    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize, 1, 1);
    const sharedUniforms = {
        uRadius: { value: 0.45 },
        uTime: { value: 0.0 },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uLightDirection: { value: new THREE.Vector3(0.5, 0.5, 0.7).normalize() },
        uCameraPosition: { value: camera.position },
        projectionMatrixInverse: { value: new THREE.Matrix4() },
        viewMatrixInverse: { value: new THREE.Matrix4() },
        uUseFragDepth: { value: true }, // Initialize the new uniform
    };
    const logMin = Math.log10(1);
    const logMax = Math.log10(1_000_000);
    let logPopulation = Math.log10(population);
    function createInstancedMesh(popLog?: number) {
        if (popLog) population = Math.round(Math.pow(10, popLog));
        const instancePositions = new Float32Array(population * 3);
        const instanceSizes = new Float32Array(population * 3);
        const instanceColors = new Float32Array(population * 3);
        randomize(1);
        for (let i = 0; i < population; i++) {
            instanceSizes[i * 3 + 0] = 1.0;
            instanceSizes[i * 3 + 1] = 1.0;
            instanceSizes[i * 3 + 2] = 1.0;
            instancePositions[i * 3 + 0] = (random() - 0.5) * WORLD_SIZE;
            instancePositions[i * 3 + 1] = (random() - 0.5) * WORLD_SIZE;
            instancePositions[i * 3 + 2] = (random() - 0.5) * WORLD_SIZE;
            const color = new THREE.Color(
                random() * 0.8 + 0.2,
                random() * 0.8 + 0.2,
                random() * 0.8 + 0.2
            );
            instanceColors[i * 3 + 0] = color.r;
            instanceColors[i * 3 + 1] = color.g;
            instanceColors[i * 3 + 2] = color.b;
        }
        planeGeometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
        planeGeometry.setAttribute('instanceSize', new THREE.InstancedBufferAttribute(instanceSizes, 3));
        planeGeometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(instanceColors, 3));
        const material = new THREE.ShaderMaterial({
            vertexShader: ParallelBillboardVertexShader,
            fragmentShader: fragmentShaderCode,
            uniforms: sharedUniforms,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: true,
        });
        if (instancedMesh) {
            scene.remove(instancedMesh);
            instancedMesh.geometry.dispose();
            (instancedMesh.material as THREE.Material).dispose();
        }
        instancedMesh = new THREE.InstancedMesh(planeGeometry, material, population);
        scene.add(instancedMesh);
        camera.lookAt(0, 0, 0);
    }
    createInstancedMesh();
    gui.add({ logPopulation }, 'logPopulation')
        .name('Population (Log 10)')
        .min(logMin)
        .max(logMax)
        .step((logMax - logMin) / 10)
        .onChange(createInstancedMesh)
        .listen();
    gui.add(sharedUniforms.uRadius, 'value', 0.01, 1).name('Radius');
    gui.add(sharedUniforms.uLightDirection.value, 'x', -1, 1).name('Light X');
    gui.add(sharedUniforms.uLightDirection.value, 'y', -1, 1).name('Light Y');
    gui.add(sharedUniforms.uLightDirection.value, 'z', -1, 1).name('Light Z');
    gui.add(sharedUniforms.uUseFragDepth, 'value').name('Use gl_FragDepth'); // Add the new GUI control

    function animate(elapsed: number) {
        sharedUniforms.uTime.value = elapsed;
        sharedUniforms.uCameraPosition.value.copy(camera.position);
        sharedUniforms.projectionMatrixInverse.value.copy(camera.projectionMatrix).invert();
        sharedUniforms.viewMatrixInverse.value.copy(camera.matrixWorld).invert();
        const currentAnimatedRadius = Math.abs(Math.sin(sharedUniforms.uTime.value / 20) / 2);
        sharedUniforms.uRadius.value = currentAnimatedRadius;
    }
    return { animate };
}
