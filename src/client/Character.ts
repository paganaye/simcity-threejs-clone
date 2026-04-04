import * as THREE from "three";
import { appConstants } from "../AppConstants";
import type { CharacterPath } from "./CharacterPath";
import { Population } from "./Population";

type RGB = [number, number, number];
type FaceName = "front" | "back" | "left" | "right" | "top" | "bottom";



export class Character {
  static readonly characterRadius = 0.4;
  static readonly detectionDiameter = Character.characterRadius * 2;
  private static readonly yAxis = new THREE.Vector3(0, 1, 0);
  private static readonly tempPosition = new THREE.Vector3();
  private static readonly tempQuaternion = new THREE.Quaternion();
  private static readonly tempScale = new THREE.Vector3(1, 1, 1);
  private static readonly tempMatrix = new THREE.Matrix4();

  tick(delta: number, index: number, walkAttribute: THREE.InstancedBufferAttribute | undefined, crowdMesh: THREE.InstancedMesh): void {
    const minX = 0;
    const maxX = this.population.mapWidth - 1;
    const minZ = 0;
    const maxZ = this.population.mapHeight - 1;

    const quadTree = this.population.quadTree;
    this.isBlocked = this.isWalking && this.checkForwardBlockage();

    // If blocked, accumulate time; if stuck too long, turn randomly
    if (this.isBlocked) {
      if (Math.random() > 0.99) {
        this.heading += (Math.random() - 0.5) * Math.PI;
      }
    }

    const shouldWalk = this.isWalking && !this.isBlocked;
    if (walkAttribute) {
      walkAttribute.setX(index, shouldWalk ? 1 : 0);
    }

    if (shouldWalk) {
      const oldX = this.x;
      const oldZ = this.z;
      this.move(delta, minX, maxX, minZ, maxZ);
      quadTree?.move(this, oldX, oldZ);
    }

    Character.tempPosition.set(this.x, 0, this.z);
    Character.tempQuaternion.setFromAxisAngle(Character.yAxis, this.heading);
    Character.tempScale.set(this.scale, this.scale, this.scale);
    Character.tempMatrix.compose(Character.tempPosition, Character.tempQuaternion, Character.tempScale);
    crowdMesh.setMatrixAt(index, Character.tempMatrix);
  }

  path: CharacterPath | undefined;
  readonly walkPhase = Math.random() * Math.PI * 2;
  x = 0;
  z = 0;
  heading = 0;
  speed = 0;
  scale = 1;
  isWalking = true;
  isBlocked = false;
  private static readonly BASE_MODEL_HEIGHT = 1.8;
  private static readonly walkTimeUniform = { value: 0 };

  constructor(readonly population: Population) { }

  setWalking(walking: boolean): void {
    this.isWalking = walking;
  }

  private checkForwardBlockage(): boolean {
    //const quadTree = this.population.quadTree;
    const fx = Math.sin(this.heading) * Character.characterRadius;
    const fz = Math.cos(this.heading) * Character.characterRadius;

    const detectionCenterX = this.x + fx;
    const detectionCenterZ = this.z + fz;

    //   const nearby = quadTree
    //     ? quadTree.queryRectangle({
    //       x: detectionCenterX - detectionRadius,
    //       z: detectionCenterZ - detectionRadius,
    //       width: detectionRadius * 2,
    //       height: detectionRadius * 2,
    //     })
    //     : this.population.characters;
    const nearby = this.population.characters;

    for (const other of nearby) {
      if (other === this) continue;


      const cdx = other.x - detectionCenterX;
      const cdz = other.z - detectionCenterZ;
      if (Math.hypot(cdx, cdz) < Character.detectionDiameter) {
        return true;
      }
    }

    return false;
  }



  move(delta: number, minX: number, maxX: number, minZ: number, maxZ: number): void {
    if (!this.isWalking) {
      return;
    }
    this.x += Math.sin(this.heading) * this.speed * delta;
    this.z += Math.cos(this.heading) * this.speed * delta;

    if (this.x < minX || this.x > maxX) {
      this.heading = -this.heading;
      this.x = Math.max(minX, Math.min(maxX, this.x));
    }
    if (this.z < minZ || this.z > maxZ) {
      this.heading = Math.PI - this.heading;
      this.z = Math.max(minZ, Math.min(maxZ, this.z));
    }
  }

  writeInstanceAnimationData(index: number, walkData: Float32Array, phaseData?: Float32Array): void {
    walkData[index] = this.isWalking ? 1 : 0;
    if (phaseData) {
      phaseData[index] = this.walkPhase;
    }
  }

  static createMaterial(): THREE.MeshPhongMaterial {
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      emissive: 0x111111,
    });
    Character.setupWalkAnimationShader(material);
    return material;
  }

  static updateAnimation(elapsed: number): void {
    Character.walkTimeUniform.value = elapsed;
  }

  static createGeometry(): THREE.BufferGeometry {
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

  static createDebugOccupancyGeometry(): THREE.RingGeometry {
    const radius = Character.characterRadius;
    return new THREE.RingGeometry(radius * 0.9, radius, 24);
  }

  private static setupWalkAnimationShader(material: THREE.MeshPhongMaterial): void {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = Character.walkTimeUniform;

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

export class CharacterOccupancyMesh {
  private mesh?: THREE.InstancedMesh;
  private readonly y = 0.02;
  private readonly tempMatrix = new THREE.Matrix4();
  private readonly tempPosition = new THREE.Vector3();
  private readonly tempScale = new THREE.Vector3(1, 1, 1);
  private readonly tempRotation = new THREE.Quaternion();
  private readonly collisionColor = new THREE.Color(0xff3333);
  private readonly freeColor = new THREE.Color(0x2ecc71);

  constructor(private readonly scene: THREE.Scene) {
    this.tempRotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  }

  init(count: number): void {
    if (this.mesh || count <= 0) {
      return;
    }

    const geometry = Character.createDebugOccupancyGeometry();
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.mesh.renderOrder = 5;
    this.scene.add(this.mesh);
  }

  update(characters: readonly Character[]): void {
    if (!this.mesh) {
      return;
    }

    for (let i = 0; i < characters.length; i++) {
      const c = characters[i];
      this.tempPosition.set(c.x, this.y, c.z);
      this.tempMatrix.compose(this.tempPosition, this.tempRotation, this.tempScale);
      this.mesh.setMatrixAt(i, this.tempMatrix);
      this.mesh.setColorAt(i, c.isWalking && !c.isBlocked ? this.freeColor : this.collisionColor);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    if (!this.mesh) {
      return;
    }

    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    const material = this.mesh.material;
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose());
    } else {
      material.dispose();
    }
    this.mesh = undefined;
  }
}
