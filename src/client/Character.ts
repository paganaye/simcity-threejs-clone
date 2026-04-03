import * as THREE from "three";
import { appConstants } from "../AppConstants";

type RGB = [number, number, number];
type FaceName = "front" | "back" | "left" | "right" | "top" | "bottom";

export class Character {
  private walkShader?: { uniforms: Record<string, { value: unknown }> };
  private static readonly BASE_MODEL_HEIGHT = 1.8;

  createMaterial(): THREE.MeshPhongMaterial {
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      emissive: 0x111111,
    });
    this.setupWalkAnimationShader(material);
    return material;
  }

  updateAnimation(elapsed: number): void {
    if (!this.walkShader) {
      return;
    }
    const uTime = this.walkShader.uniforms["uTime"];
    if (uTime) {
      uTime.value = elapsed;
    }
  }

  createGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    // 1 world unit = 1 meter, so character height in world units = height in meters.
    const worldUnitsPerMeter = 1 / appConstants.WorldUnitInMetre;
    const targetHeightWorldUnits = appConstants.CharacterHeightInMetre * worldUnitsPerMeter;
    const unitScale = targetHeightWorldUnits / Character.BASE_MODEL_HEIGHT;
    const s = (value: number) => value * unitScale;

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const colorGroups: number[] = [];
    const pivots: number[] = [];

    const COLOR_SKIN = 1;
    const COLOR_HAIR = 2;
    const COLOR_TORSO = 3;
    const COLOR_ARMS = 4;
    const COLOR_LEGS = 5;

    const addCube = (
      width: number,
      height: number,
      depth: number,
      x: number,
      y: number,
      z: number,
      defaultColorGroup: number,
      faceTriangleGroups?: Partial<Record<FaceName, [number, number]>>,
      pivot: [number, number, number] = [x, y, z]
    ) => {
      const w = width / 2;
      const h = height / 2;
      const d = depth / 2;

      const v = [
        [x - w, y - h, z + d],
        [x + w, y - h, z + d],
        [x + w, y + h, z + d],
        [x - w, y + h, z + d],
        [x - w, y - h, z - d],
        [x + w, y - h, z - d],
        [x + w, y + h, z - d],
        [x - w, y + h, z - d],
      ];

      const faces = [
        { name: "front" as FaceName, vertices: [0, 1, 2, 0, 2, 3], normal: [0, 0, 1] as RGB },
        { name: "back" as FaceName, vertices: [5, 4, 7, 5, 7, 6], normal: [0, 0, -1] as RGB },
        { name: "left" as FaceName, vertices: [4, 3, 7, 4, 0, 3], normal: [-1, 0, 0] as RGB },
        { name: "right" as FaceName, vertices: [5, 6, 2, 1, 5, 2], normal: [1, 0, 0] as RGB },
        { name: "top" as FaceName, vertices: [3, 2, 6, 3, 6, 7], normal: [0, 1, 0] as RGB },
        { name: "bottom" as FaceName, vertices: [4, 5, 1, 4, 1, 0], normal: [0, -1, 0] as RGB },
      ];

      faces.forEach(({ name, vertices: faceIndices, normal }) => {
        const triGroups = faceTriangleGroups?.[name] ?? [defaultColorGroup, defaultColorGroup];

        for (let tri = 0; tri < 2; tri++) {
          const triGroup = triGroups[tri];
          for (let corner = 0; corner < 3; corner++) {
            const idx = faceIndices[tri * 3 + corner];
            positions.push(...v[idx]);
            normals.push(...normal);
            // Base white; final per-instance tint is applied in shader.
            colors.push(1, 1, 1);
            colorGroups.push(triGroup);
            pivots.push(pivot[0], pivot[1], pivot[2]);
          }
        }
      });
    };

    addCube(s(0.4), s(0.4), s(0.4), 0, s(1.6), 0, COLOR_SKIN, {
      top: [COLOR_HAIR, COLOR_HAIR],
      back: [COLOR_HAIR, COLOR_HAIR],
      left: [COLOR_HAIR, COLOR_SKIN],
      right: [COLOR_HAIR, COLOR_SKIN],
      front: [COLOR_SKIN, COLOR_SKIN],
      bottom: [COLOR_SKIN, COLOR_SKIN],
    });

    addCube(s(0.4), s(0.6), s(0.4), 0, s(0.9), 0, COLOR_TORSO);
    addCube(s(0.15), s(0.6), s(0.15), s(-0.35), s(1.0), 0, COLOR_ARMS, undefined, [s(-0.35), s(1.28), 0]);
    addCube(s(0.15), s(0.6), s(0.15), s(0.35), s(1.0), 0, COLOR_ARMS, undefined, [s(0.35), s(1.28), 0]);
    addCube(s(0.15), s(0.6), s(0.15), s(-0.15), s(0.3), 0, COLOR_LEGS, undefined, [s(-0.15), s(0.6), 0]);
    addCube(s(0.15), s(0.6), s(0.15), s(0.15), s(0.3), 0, COLOR_LEGS, undefined, [s(0.15), s(0.6), 0]);

    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
    geometry.setAttribute("aColorGroup", new THREE.BufferAttribute(new Float32Array(colorGroups), 1));
    geometry.setAttribute("aPivot", new THREE.BufferAttribute(new Float32Array(pivots), 3));

    return geometry;
  }

  private setupWalkAnimationShader(material: THREE.MeshPhongMaterial): void {
    material.onBeforeCompile = (shader) => {
      this.walkShader = shader;
      shader.uniforms.uTime = { value: 0 };

      shader.vertexShader = `
attribute float aPart;
attribute vec3 aPivot;
attribute float aWalk;
attribute float aPhase;
    attribute float aColorGroup;
uniform float uTime;
    varying vec3 vInstanceTint;
` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
vec3 transformed = vec3(position);
vec3 instanceTint = vec3(1.0);

float h1 = fract(sin(aPhase * 12.9898 +  1.123) * 43758.5453);
float h2 = fract(sin(aPhase * 78.233  + 11.137) * 12741.1579);
float h3 = fract(sin(aPhase * 36.853  + 31.417) * 24634.6345);
float h4 = fract(sin(aPhase * 93.271  +  7.731) * 15397.4231);
float h5 = fract(sin(aPhase * 27.197  + 19.777) * 29833.7347);

vec3 skinDark = vec3(0.47, 0.31, 0.22);
vec3 skinLight = vec3(1.00, 0.82, 0.72);
vec3 skinColor = mix(skinDark, skinLight, h1);

vec3 hairA = vec3(0.08, 0.08, 0.08);
vec3 hairB = vec3(0.78, 0.67, 0.44);
vec3 hairColor = mix(hairA, hairB, h2 * 0.75);

vec3 torsoA = vec3(0.16, 0.45, 0.88);
vec3 torsoB = vec3(0.88, 0.33, 0.42);
vec3 torsoColor = mix(torsoA, torsoB, h3);

vec3 legsA = vec3(0.12, 0.16, 0.28);
vec3 legsB = vec3(0.52, 0.52, 0.55);
vec3 legsColor = mix(legsA, legsB, h4);

float tshirt = step(0.62, h5);
float occasionalMix = step(0.92, h2);
float armSkinMix = mix(tshirt, 0.5, occasionalMix);

if (aColorGroup < 1.5) {
  instanceTint = vec3(1.0);
} else if (aColorGroup < 2.5) {
  instanceTint = skinColor;
} else if (aColorGroup < 3.5) {
  instanceTint = hairColor;
} else if (aColorGroup < 4.5) {
  instanceTint = torsoColor;
} else if (aColorGroup < 5.5) {
  // Arms: usually same as torso; tee-shirt style uses skin; occasional mix possible.
  instanceTint = mix(torsoColor, skinColor, clamp(armSkinMix, 0.0, 1.0));
} else if (aColorGroup < 6.5) {
  instanceTint = legsColor;
}
vInstanceTint = instanceTint;

if (aWalk > 0.5 && aColorGroup > 3.5) {
  float gait = sin(uTime * 8.0 + aPhase);
  float angle = 0.0;
  float isLeft = step(aPivot.x, 0.0);
  float sideSign = mix(1.0, -1.0, isLeft);

  if (aColorGroup < 4.5) {
    angle = sideSign * gait * 0.40;  // arms
  } else if (aColorGroup > 4.5) {
    angle = -sideSign * gait * 0.70; // legs
  }

  float c = cos(angle);
  float s = sin(angle);
  vec3 p = transformed - aPivot;
  vec3 rotated = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  transformed = rotated + aPivot;
}
`
      );

  shader.fragmentShader = `
varying vec3 vInstanceTint;
` + shader.fragmentShader;

  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <color_fragment>",
    `
#include <color_fragment>
diffuseColor.rgb *= vInstanceTint;
`
  );
    };

    material.needsUpdate = true;
  }
}
