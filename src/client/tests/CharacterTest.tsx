import * as THREE from "three";
import { Page } from "../Page";

enum CharacterState {
  STANDING = 0,
  WALKING = 1,
  RUNNING = 2,
  SITTING = 3,
}

interface CharacterInstance {
  x: number;
  z: number;
  heading: number;
  state: CharacterState;
  speed: number;
  animate: boolean;
}

type RGB = [number, number, number];
type FaceName = "front" | "back" | "left" | "right" | "top" | "bottom";

export default class CharacterTest extends Page {
  private characters: CharacterInstance[] = [];
  private instancedMesh!: THREE.InstancedMesh;
  private lastElapsed = 0;

  private readonly tempMatrix = new THREE.Matrix4();
  private readonly tempPosition = new THREE.Vector3();
  private readonly tempQuaternion = new THREE.Quaternion();
  private readonly tempScale = new THREE.Vector3(1, 1, 1);

  run(): Promise<void> | void {
    const numInstances = 50;
    const walkersCount = Math.floor(numInstances * 0.1);

    // Créer la géométrie du personnage (6 cubes)
    const geometry = this.createCharacterGeometry();

    // Vertex colors pour gérer les couleurs par partie du corps.
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      emissive: 0x111111,
    });

    this.instancedMesh = new THREE.InstancedMesh(geometry, material, numInstances);
    this.scene.add(this.instancedMesh);

    const walkingFlags = new Array<boolean>(numInstances).fill(false);
    for (let i = 0; i < walkersCount; i++) {
      walkingFlags[i] = true;
    }
    for (let i = numInstances - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = walkingFlags[i];
      walkingFlags[i] = walkingFlags[j];
      walkingFlags[j] = tmp;
    }

    // Créer les données des instances
    for (let i = 0; i < numInstances; i++) {
      // Position aléatoire
      const x = (Math.random() - 0.5) * 30;
      const z = (Math.random() - 0.5) * 30;
      const heading = Math.random() * Math.PI * 2;
      const isWalking = walkingFlags[i];
      const state = isWalking ? CharacterState.WALKING : CharacterState.STANDING;
      const speed = isWalking ? 1.2 + Math.random() * 0.5 : 0;

      this.tempPosition.set(x, 0, z);
      this.tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
      this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
      this.instancedMesh.setMatrixAt(i, this.tempMatrix);

      this.characters.push({
        x,
        z,
        heading,
        state,
        speed,
        animate: isWalking,
      });
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  override loop(elapsed: number): void {
    const delta = this.lastElapsed === 0 ? 0 : elapsed - this.lastElapsed;
    this.lastElapsed = elapsed;

    if (delta <= 0) {
      return;
    }

    const maxRange = 18;

    for (let i = 0; i < this.characters.length; i++) {
      const character = this.characters[i];
      if (character.state !== CharacterState.WALKING) {
        continue;
      }

      character.x += Math.cos(character.heading) * character.speed * delta;
      character.z += Math.sin(character.heading) * character.speed * delta;

      if (character.x > maxRange || character.x < -maxRange || character.z > maxRange || character.z < -maxRange) {
        character.heading += Math.PI;
      }

      this.tempPosition.set(character.x, 0, character.z);
      this.tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), character.heading);
      this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
      this.instancedMesh.setMatrixAt(i, this.tempMatrix);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  private createCharacterGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    const skin: RGB = [1.0, 0.72, 0.78];
    const hair: RGB = [0.36, 0.23, 0.13];
    const torso: RGB = [0.20, 0.52, 0.95];
    const arms: RGB = [0.15, 0.78, 0.46];
    const legs: RGB = [0.26, 0.28, 0.33];

    // Helper pour ajouter un cube à la géométrie
    const addCube = (
      width: number,
      height: number,
      depth: number,
      x: number,
      y: number,
      z: number,
      defaultColor: RGB,
      faceTriangleColors?: Partial<Record<FaceName, [RGB, RGB]>>
    ) => {
      const w = width / 2;
      const h = height / 2;
      const d = depth / 2;

      // 8 vertices du cube
      const v = [
        [x - w, y - h, z + d], // 0 FBL
        [x + w, y - h, z + d], // 1 FBR
        [x + w, y + h, z + d], // 2 FTR
        [x - w, y + h, z + d], // 3 FTL
        [x - w, y - h, z - d], // 4 BBL
        [x + w, y - h, z - d], // 5 BBR
        [x + w, y + h, z - d], // 6 BTR
        [x - w, y + h, z - d], // 7 BTL
      ];

      // Faces (2 triangles par face)
      const faces = [
        { name: "front" as FaceName, vertices: [0, 1, 2, 0, 2, 3], normal: [0, 0, 1] as RGB },
        { name: "back" as FaceName, vertices: [5, 4, 7, 5, 7, 6], normal: [0, 0, -1] as RGB },
        { name: "left" as FaceName, vertices: [4, 3, 7, 4, 0, 3], normal: [-1, 0, 0] as RGB },
        { name: "right" as FaceName, vertices: [5, 6, 2,1, 5, 2 ], normal: [1, 0, 0] as RGB },
        { name: "top" as FaceName, vertices: [3, 2, 6, 3, 6, 7], normal: [0, 1, 0] as RGB },
        { name: "bottom" as FaceName, vertices: [4, 5, 1, 4, 1, 0], normal: [0, -1, 0] as RGB },
      ];

      faces.forEach(({ name, vertices: faceIndices, normal }) => {
        const triColors = faceTriangleColors?.[name] ?? [defaultColor, defaultColor];

        for (let tri = 0; tri < 2; tri++) {
          const triColor = triColors[tri];
          for (let corner = 0; corner < 3; corner++) {
            const idx = faceIndices[tri * 3 + corner];
            positions.push(...v[idx]);
            normals.push(...normal);
            colors.push(...triColor);
          }
        }
      });
    };

    // Tête: 6 triangles cheveux + 6 triangles peau (sans géométrie additionnelle).
    addCube(0.4, 0.4, 0.4, 0, 1.6, 0, skin, {
      top: [hair, hair],
      back: [hair, hair],
      left: [hair, skin],
      right: [hair, skin],
      front: [skin, skin],
      bottom: [skin, skin],
    });
    // Corps
    addCube(0.4, 0.6, 0.4, 0, 0.9, 0, torso);
    // Bras gauche
    addCube(0.15, 0.6, 0.15, -0.35, 1.0, 0, arms);
    // Bras droit
    addCube(0.15, 0.6, 0.15, 0.35, 1.0, 0, arms);
    // Jambe gauche
    addCube(0.15, 0.6, 0.15, -0.15, 0.3, 0, legs);
    // Jambe droite
    addCube(0.15, 0.6, 0.15, 0.15, 0.3, 0, legs);

    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));

    return geometry;
  }
}
