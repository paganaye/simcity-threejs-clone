import * as THREE from "three";
import { Character } from "./Character";
import { appConstants } from "../AppConstants";
import { Population } from "./Population";

export interface CrowdOptions {
    count?: number;
    childRatio?: number;
}

export class Crowd3D {
    private crowdMesh?: THREE.InstancedMesh;
    private lastElapsed = 0;
    readonly population = new Population();

    constructor(private readonly scene: THREE.Scene) { }

    init(mapWidth: number, mapHeight: number, options: CrowdOptions = {}): void {
        const count = options.count ?? 1500;
        const childRatio = options.childRatio ?? 0.18;
        const worldUnitsPerMeter = 1 / appConstants.WorldUnitInMetre;

        const geometry = Character.createGeometry();
        const material = Character.createMaterial();
        this.crowdMesh = new THREE.InstancedMesh(geometry, material, count);
        this.crowdMesh.userData.selectableType = "character";
        this.scene.add(this.crowdMesh);

        const walkWeights = new Float32Array(count);
        const walkPhases = new Float32Array(count);
        const tempPos = new THREE.Vector3();
        const tempQuat = new THREE.Quaternion();
        const tempScale = new THREE.Vector3();
        const tempMatrix = new THREE.Matrix4();
        const yAxis = new THREE.Vector3(0, 1, 0);

        this.population.mapWidth = mapWidth;
        this.population.mapHeight = mapHeight;

        for (let i = 0; i < count; i++) {
            const character = this.population.newCharacter();
            character.x = Math.random() * (mapWidth - 1);
            character.z = Math.random() * (mapHeight - 1);
            character.heading = Math.random() * Math.PI * 2;
            character.isWalking = true;
            const isChild = Math.random() < childRatio;
            character.scale = isChild ? appConstants.ChildHeightInMetre / appConstants.CharacterHeightInMetre : 1;
            const speed = isChild ? 1.0 + Math.random() * 0.5 : 1.2 + Math.random() * 0.6;
            character.speed = character.isWalking ? speed * worldUnitsPerMeter : 0;

            tempPos.set(character.x, 0, character.z);
            tempQuat.setFromAxisAngle(yAxis, character.heading);
            tempScale.set(character.scale, character.scale, character.scale);
            tempMatrix.compose(tempPos, tempQuat, tempScale);
            this.crowdMesh.setMatrixAt(i, tempMatrix);
            character.writeInstanceAnimationData(i, walkWeights, walkPhases);
        }

        geometry.setAttribute("aWalk", new THREE.InstancedBufferAttribute(walkWeights, 1));
        geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(walkPhases, 1));
        this.crowdMesh.instanceMatrix.needsUpdate = true;

        this.population.setupQuadTree(mapWidth, mapHeight);
    }

    tick(elapsed: number): void {
        Character.updateAnimation(elapsed);
        if (!this.crowdMesh) return;

        const walkAttribute = this.crowdMesh.geometry.getAttribute("aWalk") as THREE.InstancedBufferAttribute | undefined;
        const delta = this.lastElapsed === 0 ? 0 : elapsed - this.lastElapsed;
        this.lastElapsed = elapsed;
        if (delta <= 0) return;

        const { characters } = this.population;
        for (let i = 0; i < characters.length; i++) {
            characters[i].tick(delta, i, walkAttribute, this.crowdMesh);
        }


        if (walkAttribute) walkAttribute.needsUpdate = true;
        this.crowdMesh.instanceMatrix.needsUpdate = true;
    }

    dispose(): void {
        if (!this.crowdMesh) return;
        this.scene.remove(this.crowdMesh);
        this.crowdMesh.geometry.dispose();
        const mat = this.crowdMesh.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat.dispose();
        this.crowdMesh = undefined;
        this.population.clear();
        this.lastElapsed = 0;
    }
}
