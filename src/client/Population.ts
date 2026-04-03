import * as THREE from "three";
import { Character } from "./Character";
import { appConstants } from "../AppConstants";

interface PopulationAgent {
  x: number;
  z: number;
  heading: number;
  speed: number;
  walking: boolean;
}

export interface PopulationOptions {
  density?: number;
  minCount?: number;
  maxCount?: number;
  walkingRatio?: number;
}

export class Population {
  private crowdMesh?: THREE.InstancedMesh;
  private readonly crowdCharacter = new Character();
  private crowdLastElapsed = 0;
  private readonly crowdAgents: PopulationAgent[] = [];

  private readonly tempMatrix = new THREE.Matrix4();
  private readonly tempPosition = new THREE.Vector3();
  private readonly tempQuaternion = new THREE.Quaternion();
  private readonly tempScale = new THREE.Vector3(1, 1, 1);

  constructor(private readonly scene: THREE.Scene) {}

  init(mapWidth: number, mapHeight: number, options: PopulationOptions = {}): void {
    const safeWidth = Math.max(8, mapWidth || 64);
    const safeHeight = Math.max(8, mapHeight || 64);
    const area = safeWidth * safeHeight;

    const density = options.density ?? 0.2;
    const minCount = options.minCount ?? 200;
    const maxCount = options.maxCount ?? 1500;
    const walkingRatio = options.walkingRatio ?? 0.7;

    const targetCrowd = Math.max(minCount, Math.min(maxCount, Math.floor(area * density)));

    const geometry = this.crowdCharacter.createGeometry();
    const material = this.crowdCharacter.createMaterial();

    this.crowdMesh = new THREE.InstancedMesh(geometry, material, targetCrowd);
    this.scene.add(this.crowdMesh);

    const walkWeights = new Float32Array(targetCrowd);
    const walkPhases = new Float32Array(targetCrowd);
    const worldUnitsPerMeter = 1 / appConstants.TileSizeInMetre;

    for (let i = 0; i < targetCrowd; i++) {
      const x = Math.random() * (safeWidth - 1);
      const z = Math.random() * (safeHeight - 1);
      const heading = Math.random() * Math.PI * 2;
      const walking = Math.random() < walkingRatio;
      const speedMetersPerSecond = 1.2 + Math.random() * 0.6;
      const speed = walking ? speedMetersPerSecond * worldUnitsPerMeter : 0;

      this.crowdAgents.push({ x, z, heading, speed, walking });

      this.tempPosition.set(x, 0, z);
      this.tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
      this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
      this.crowdMesh.setMatrixAt(i, this.tempMatrix);

      walkWeights[i] = walking ? 1 : 0;
      walkPhases[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute("aWalk", new THREE.InstancedBufferAttribute(walkWeights, 1));
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(walkPhases, 1));
    this.crowdMesh.instanceMatrix.needsUpdate = true;
  }

  update(elapsed: number, mapWidth: number, mapHeight: number): void {
    this.crowdCharacter.updateAnimation(elapsed);

    if (!this.crowdMesh) {
      return;
    }

    const delta = this.crowdLastElapsed === 0 ? 0 : elapsed - this.crowdLastElapsed;
    this.crowdLastElapsed = elapsed;

    if (delta <= 0) {
      return;
    }

    const safeWidth = Math.max(8, mapWidth || 64);
    const safeHeight = Math.max(8, mapHeight || 64);
    const minX = 0;
    const maxX = safeWidth - 1;
    const minZ = 0;
    const maxZ = safeHeight - 1;

    for (let i = 0; i < this.crowdAgents.length; i++) {
      const agent = this.crowdAgents[i];
      if (agent.walking) {
        agent.x += Math.sin(agent.heading) * agent.speed * delta;
        agent.z += Math.cos(agent.heading) * agent.speed * delta;

        if (agent.x < minX || agent.x > maxX) {
          agent.heading = -agent.heading;
          agent.x = Math.max(minX, Math.min(maxX, agent.x));
        }
        if (agent.z < minZ || agent.z > maxZ) {
          agent.heading = Math.PI - agent.heading;
          agent.z = Math.max(minZ, Math.min(maxZ, agent.z));
        }
      }

      this.tempPosition.set(agent.x, 0, agent.z);
      this.tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), agent.heading);
      this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
      this.crowdMesh.setMatrixAt(i, this.tempMatrix);
    }

    this.crowdMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    if (!this.crowdMesh) {
      return;
    }

    this.scene.remove(this.crowdMesh);
    this.crowdMesh.geometry.dispose();

    const material = this.crowdMesh.material;
    if (Array.isArray(material)) {
      material.forEach((m) => m.dispose());
    } else {
      material.dispose();
    }

    this.crowdMesh = undefined;
    this.crowdAgents.length = 0;
    this.crowdLastElapsed = 0;
  }
}
