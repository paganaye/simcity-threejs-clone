import * as THREE from "three";
import { vert, frag } from "../../utils/glsl"; // On garde votre système d'importation
import { SceneContext } from "../..";

const numInstances = 1_000_000;

const WORLD_SIZE = Math.pow(numInstances, 1 / 3);
// 1. Vertex Shader pour InstancedMesh avec Billboarding
const vertexShaderCode = vert`
    varying vec2 vUv;
    varying vec3 vInstanceColor; // Couleur de l'instance passée au fragment shader

    attribute vec3 instancePosition; // Position de chaque instance
    attribute vec3 instanceColor;    // Couleur de chaque instance

    // uniform mat4 viewMatrix;     // Supprimé: Fourni par Three.js
    // uniform vec3 cameraPosition;  // Supprimé: Fourni par Three.js
                                  // viewMatrix et cameraPosition sont des uniforms built-in de Three.js

    void main() {
        vUv = uv;
        vInstanceColor = instanceColor;

        // --- Billboarding dans le Vertex Shader ---
        vec3 P = instancePosition; // Position de l'instance dans le monde
        vec3 C = cameraPosition;   // Position de la caméra dans le monde (uniforme built-in)

        vec3 lookDir = normalize(C - P); // Le "forward" de notre billboard

        vec3 worldUp = vec3(0.0, 1.0, 0.0);
        
        vec3 billboardRight = normalize(cross(worldUp, lookDir));
        // Recalculer billboardUp pour assurer l'orthogonalité, surtout si worldUp n'est pas parfaitement orthogonal à lookDir
        vec3 billboardUp = normalize(cross(lookDir, billboardRight)); 

        mat3 billboardMatrix = mat3(billboardRight, billboardUp, lookDir);

        vec3 worldPosition = billboardMatrix * position + P;
        
        // projectionMatrix et viewMatrix sont des uniforms built-in de Three.js
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
    }
`;

// 2. Fragment Shader (reçoit la couleur de l'instance)
const fragmentShaderCode = frag`
    varying vec2 vUv;
    varying vec3 vInstanceColor; // Reçoit la couleur de l'instance

    uniform float uRadius;
    uniform vec2 uCenter;
    uniform vec3 uLightDirection;

    void main() {
        float dist = distance(vUv, uCenter);

        if (dist < uRadius) {
            vec2 xy_from_center = (vUv - uCenter) / uRadius;
            float z_sphere_sq = 1.0 - dot(xy_from_center, xy_from_center);

            if (z_sphere_sq > 0.0) {
                float z_sphere = sqrt(z_sphere_sq);
                vec3 pseudoNormal = normalize(vec3(xy_from_center.x, xy_from_center.y, z_sphere));
                float diffuseLighting = max(0.0, dot(pseudoNormal, uLightDirection));
                float ambientIntensity = 0.25;
                vec3 finalColor = vInstanceColor * (ambientIntensity + diffuseLighting * (1.0 - ambientIntensity));
                gl_FragColor = vec4(finalColor, 1.0);
            } else {
                discard;
            }
        } else {
            discard;
        }
    }
`;

export default function shaderTest({ scene, camera }: SceneContext) {
    const planeSize = 2;

    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize, 1, 1);

    const instancePositions = new Float32Array(numInstances * 3);
    const instanceColors = new Float32Array(numInstances * 3);

    for (let i = 0; i < numInstances; i++) {
        instancePositions[i * 3 + 0] = (Math.random() - 0.5) * WORLD_SIZE;
        instancePositions[i * 3 + 1] = (Math.random() - 0.5) * WORLD_SIZE;
        instancePositions[i * 3 + 2] = (Math.random() - 0.5) * WORLD_SIZE;

        const color = new THREE.Color(Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2);
        instanceColors[i * 3 + 0] = color.r;
        instanceColors[i * 3 + 1] = color.g;
        instanceColors[i * 3 + 2] = color.b;
    }

    planeGeometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
    planeGeometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(instanceColors, 3));

    const sharedUniforms = {
        uRadius: { value: 0.45 },
        uTime: { value: 0.0 },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uLightDirection: { value: new THREE.Vector3(0.5, 0.5, 0.7).normalize() },
    };

    const material = new THREE.ShaderMaterial({
        vertexShader: vertexShaderCode,
        fragmentShader: fragmentShaderCode,
        uniforms: sharedUniforms,
        side: THREE.DoubleSide,
        transparent: true
    });

    const instancedMesh = new THREE.InstancedMesh(planeGeometry, material, numInstances);
    scene.add(instancedMesh);

    const clock = new THREE.Clock();
    const pulsationSpeed = 1.5;
    const minRadius = 0.15;
    const maxRadius = 0.5;
    camera.position.set(WORLD_SIZE * -0.5, WORLD_SIZE, WORLD_SIZE);
    camera.lookAt(0, 0, 0);

    function animate() {
        const elapsedTime = clock.getElapsedTime();
        sharedUniforms.uTime.value = elapsedTime;

        const radiusRange = maxRadius - minRadius;
        const currentAnimatedRadius = minRadius + ((Math.sin(elapsedTime * pulsationSpeed) + 1.0) / 2.0) * radiusRange;
        sharedUniforms.uRadius.value = currentAnimatedRadius;
    }
    return animate;
}
