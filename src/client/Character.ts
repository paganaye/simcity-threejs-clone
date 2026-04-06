import * as THREE from "three";
import { appConstants } from "../AppConstants";
import { rotateTowards } from "../sim/utils";
import type { CharacterPath } from "./CharacterPath";
import { Population } from "./Population";

type RGB = [number, number, number];
type FaceName = "front" | "back" | "left" | "right" | "top" | "bottom";
type TargetType = 'goal' | 'detour';
type CharacterTarget = { x: number; z: number; type: TargetType };

export interface CharacterDebugView {
  occupancyMesh?: THREE.InstancedMesh;
  targetLineMesh?: THREE.LineSegments;
}



export class Character {
  static readonly characterRadius = 0.4;
  static readonly charDiameter = Character.characterRadius * 2;
  private static readonly yAxis = new THREE.Vector3(0, 1, 0);
  private static readonly tempPosition = new THREE.Vector3();
  private static readonly tempQuaternion = new THREE.Quaternion();
  private static readonly tempScale = new THREE.Vector3(1, 1, 1);
  private static readonly tempMatrix = new THREE.Matrix4();
  private static readonly debugOccupancyY = 0.02;
  private static readonly debugOccupancyRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  private static readonly debugOccupancyScale = new THREE.Vector3(1, 1, 1);
  private static readonly debugOccupancyPosition = new THREE.Vector3();
  private static readonly debugOccupancyMatrix = new THREE.Matrix4();
  private static readonly debugCollisionColor = new THREE.Color(0xff3333);
  private static readonly debugFreeColor = new THREE.Color(0x2ecc71);
  private static readonly debugTargetLineY = 0.05;
  private static readonly debugTargetLineStartColor = new THREE.Color(0x4fc3f7);
  private static readonly debugTargetLineEndColor = new THREE.Color(0xffd166);
  private static readonly targetTurnSpeed = 3;
  private static readonly baseWalkCycleFrequency = 8.0;
  private static readonly referenceWalkSpeed = 1.4;
  blockedBy: Character | null = null;

  path: CharacterPath | undefined;
  readonly walkPhase = Math.random() * Math.PI * 2;
  x = 0;
  z = 0;
  private realTarget: CharacterTarget | null = null;
  private detourTarget: CharacterTarget | null = null;



  tick(delta: number, index: number, walkAttribute: THREE.InstancedBufferAttribute | undefined, crowdMesh: THREE.InstancedMesh): void {
    const minX = 0;
    const maxX = this.population.mapWidth - 1;
    const minZ = 0;
    const maxZ = this.population.mapHeight - 1;

    const quadTree = this.population.quadTree;
    this.updateHeadingToTarget(delta);
    this.isBlocked = this.isWalking && this.checkForwardBlockage();
    this.waitTime = this.isBlocked ? this.waitTime + delta : 0;
    if (this.waitTime > 2 && this.blockedBy && this.blockedBy.blockedBy === this) {
      // If mutually blocked for more than 2 seconds, we just teleport them Character.charDiameter apart
      const midx = (this.x + this.blockedBy.x) / 2;
      const midz = (this.z + this.blockedBy.z) / 2;
      const angle = Math.atan2(this.blockedBy.x - this.x, this.blockedBy.z - this.z);
      const offsetX = Math.sin(angle) * Character.charDiameter;
      const offsetZ = Math.cos(angle) * Character.charDiameter;
      this.x = midx - offsetX / 2;
      this.z = midz - offsetZ / 2;
      this.blockedBy.x = midx + offsetX / 2;
      this.blockedBy.z = midz + offsetZ / 2;
    }
    // If blocked, push a perpendicular detour waypoint to navigate around the obstacle.
    if (this.isBlocked) {
      if (Math.random() < 0.0001) this.detourToTheRight = !this.detourToTheRight; // Occasionally switch detour direction to add some variability to the paths
      this.heading += (this.detourToTheRight ? 1 : -1) * Math.PI / 2 / 100;
      //const perpAngle = this.heading + (this.detourToTheRight ? 1 : -1) * Math.PI / 2;
      const detourDist = Character.charDiameter * 1.1;
      this.detourTarget = {
        x: this.x + Math.sin(this.heading) * detourDist,
        z: this.z + Math.cos(this.heading) * detourDist,
        type: 'detour'
      };
    }

    // Stand still while turning to face a detour waypoint.
    // const isTurningToDetour = this.isWalking && this.target?.type === 'detour' && this.isAngularlyMisaligned();

    const shouldWalk = this.isWalking && !this.isBlocked; // && !isTurningToDetour;
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


  get target(): CharacterTarget | null {
    return this.detourTarget ?? this.realTarget ?? null;
  }



  heading = 0;
  speed = 0;
  scale = 1;
  isWalking = true;
  isBlocked = false;
  detourToTheRight = Math.random() > 0.5;
  /** Seconds spent continuously blocked. Resets to 0 when the character moves freely. */
  waitTime = 0;
  private static readonly BASE_MODEL_HEIGHT = 1.8;
  private static readonly walkTimeUniform = { value: 0 };

  constructor(readonly population: Population) { }

  setTarget(target: { x: number; z: number }): void {
    this.detourTarget = null;
    this.realTarget = { x: target.x, z: target.z, type: 'goal' };
  }

  clearTarget(): void {
    this.detourTarget = null;
    this.realTarget = null;
  }

  setWalking(walking: boolean): void {
    this.isWalking = walking;
  }

  get walkCadence(): number {
    const normalizedSpeed = this.speed / Character.referenceWalkSpeed;
    const strideScale = Math.max(this.scale, 0.001);
    return Math.max(0.75, normalizedSpeed / strideScale);
  }


  private updateHeadingToTarget(delta: number): void {
    const t = this.target;
    if (!t) {
      return;
    }

    const dx = t.x - this.x;
    const dz = t.z - this.z;
    const dist2 = dx * dx + dz * dz;

    // Auto-pop detour waypoints once reached.
    if (t.type === 'detour' && dist2 < 0.25) {
      this.detourTarget = null;
      return;
    }

    if (dist2 < 0.0001) {
      return;
    }

    const desiredHeading = Math.atan2(dx, dz);
    this.heading = rotateTowards(this.heading, desiredHeading, Character.targetTurnSpeed * delta);
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
      if (Math.hypot(cdx, cdz) < Character.charDiameter) {
        this.blockedBy = other;
        return true;
      }
    }

    this.blockedBy = null;
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

  writeInstanceAnimationData(index: number, walkData: Float32Array, phaseData?: Float32Array, cadenceData?: Float32Array): void {
    walkData[index] = this.isWalking ? 1 : 0;
    if (phaseData) {
      phaseData[index] = this.walkPhase;
    }
    if (cadenceData) {
      cadenceData[index] = this.walkCadence;
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

  static createDebugView(scene: THREE.Scene, count: number): CharacterDebugView | undefined {
    if (count <= 0) {
      return undefined;
    }

    const debugView: CharacterDebugView = {
      occupancyMesh: Character.createOccupancyMesh(scene, count),
      targetLineMesh: Character.createTargetLineMesh(scene, count),
    };
    return debugView;
  }

  static updateDebugView(debugView: CharacterDebugView | undefined, characters: readonly Character[]): void {
    if (!debugView) {
      return;
    }

    Character.updateOccupancyMesh(debugView.occupancyMesh, characters);
    Character.updateTargetLineMesh(debugView.targetLineMesh, characters);
  }

  static disposeDebugView(scene: THREE.Scene, debugView: CharacterDebugView | undefined): void {
    if (!debugView) {
      return;
    }

    Character.disposeOccupancyMesh(scene, debugView.occupancyMesh);
    Character.disposeTargetLineMesh(scene, debugView.targetLineMesh);
  }

  static createOccupancyMesh(scene: THREE.Scene, count: number): THREE.InstancedMesh | undefined {
    if (count <= 0) {
      return undefined;
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

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    mesh.renderOrder = 5;
    scene.add(mesh);
    return mesh;
  }

  static updateOccupancyMesh(mesh: THREE.InstancedMesh | undefined, characters: readonly Character[]): void {
    if (!mesh) {
      return;
    }

    for (let i = 0; i < characters.length; i++) {
      const c = characters[i];
      Character.debugOccupancyPosition.set(c.x, Character.debugOccupancyY, c.z);
      Character.debugOccupancyMatrix.compose(
        Character.debugOccupancyPosition,
        Character.debugOccupancyRotation,
        Character.debugOccupancyScale
      );
      mesh.setMatrixAt(i, Character.debugOccupancyMatrix);
      mesh.setColorAt(i, c.isWalking && !c.isBlocked ? Character.debugFreeColor : Character.debugCollisionColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  static disposeOccupancyMesh(scene: THREE.Scene, mesh: THREE.InstancedMesh | undefined): void {
    if (!mesh) {
      return;
    }

    scene.remove(mesh);
    mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose());
    } else {
      material.dispose();
    }
  }

  static createTargetLineMesh(scene: THREE.Scene, count: number): THREE.LineSegments | undefined {
    if (count <= 0) {
      return undefined;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      toneMapped: false,
    });

    const lines = new THREE.LineSegments(geometry, material);
    lines.renderOrder = 6;
    scene.add(lines);
    return lines;
  }

  static updateTargetLineMesh(lines: THREE.LineSegments | undefined, characters: readonly Character[]): void {
    if (!lines) {
      return;
    }

    const position = lines.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    const color = lines.geometry.getAttribute("color") as THREE.BufferAttribute | undefined;
    if (!position || !color) {
      return;
    }

    const lineCount = Math.min(characters.length, Math.floor(position.count / 2));
    for (let i = 0; i < lineCount; i++) {
      const c = characters[i];
      const lineStartIndex = i * 2;
      let tx = c.x;
      let tz = c.z;
      if (c.target) {
        tx = c.target.x;
        tz = c.target.z;
      }

      position.setXYZ(lineStartIndex, c.x, Character.debugTargetLineY, c.z);
      position.setXYZ(lineStartIndex + 1, tx, Character.debugTargetLineY, tz);

      color.setXYZ(lineStartIndex, Character.debugTargetLineStartColor.r, Character.debugTargetLineStartColor.g, Character.debugTargetLineStartColor.b);
      color.setXYZ(lineStartIndex + 1, Character.debugTargetLineEndColor.r, Character.debugTargetLineEndColor.g, Character.debugTargetLineEndColor.b);
    }

    position.needsUpdate = true;
    color.needsUpdate = true;
  }

  static disposeTargetLineMesh(scene: THREE.Scene, lines: THREE.LineSegments | undefined): void {
    if (!lines) {
      return;
    }

    scene.remove(lines);
    lines.geometry.dispose();
    const material = lines.material;
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose());
    } else {
      material.dispose();
    }
  }

  private static setupWalkAnimationShader(material: THREE.MeshPhongMaterial): void {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = Character.walkTimeUniform;

      shader.vertexShader = `
attribute float aPart;
attribute vec3 aPivot;
attribute float aWalk;
attribute float aPhase;
attribute float aCadence;
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
  float gait = sin(uTime * ${Character.baseWalkCycleFrequency.toFixed(1)} * aCadence + aPhase);
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
