import * as THREE from "three";
import { Character } from "../Character";
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

export default class CharacterTest extends Page {
  private readonly character = new Character();
  private readonly characters: CharacterInstance[] = [];
  private instancedMesh!: THREE.InstancedMesh;
  private lastElapsed = 0;

  private readonly tempMatrix = new THREE.Matrix4();
  private readonly tempPosition = new THREE.Vector3();
  private readonly tempQuaternion = new THREE.Quaternion();
  private readonly tempScale = new THREE.Vector3(1, 1, 1);

  run(): Promise<void> | void {
    const numInstances = 50;
    const walkersCount = Math.floor(numInstances * 0.5);

    const geometry = this.character.createGeometry();
    const material = this.character.createMaterial();

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

    const walkWeights = new Float32Array(numInstances);
    const walkPhases = new Float32Array(numInstances);

    for (let i = 0; i < numInstances; i++) {
      const x = (Math.random() - 0.5) * 30;
      const z = (Math.random() - 0.5) * 30;
      const heading = Math.random() * Math.PI * 2;
      const isWalking = walkingFlags[i];
      const state = isWalking ? CharacterState.WALKING : CharacterState.STANDING;
      const speed = isWalking ? 1.2 + Math.random() * 0.5 : 0;

      walkWeights[i] = isWalking ? 1 : 0;
      walkPhases[i] = Math.random() * Math.PI * 2;

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

    geometry.setAttribute("aWalk", new THREE.InstancedBufferAttribute(walkWeights, 1));
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(walkPhases, 1));

    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  override loop(elapsed: number): void {
    this.character.updateAnimation(elapsed);

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

      character.x += Math.sin(character.heading) * character.speed * delta;
      character.z += Math.cos(character.heading) * character.speed * delta;

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
}
