import * as THREE from "three";
import { appConstants } from "../AppConstants";
import { Character } from "./Character";
import { QuadTree } from "../sim/QuadTree";
import type { IRectangle } from "../sim/IPoint";

export interface CrowdOptions {
    count?: number;
    childRatio?: number;
}

export class Population {
    private readonly _characters: Character[] = [];
    private crowdMesh?: THREE.InstancedMesh;
    private lastElapsed = 0;
    mapWidth = 0;
    mapHeight = 0;
    quadTree?: QuadTree<Character>;

    constructor(private readonly scene?: THREE.Scene) { }

    get characters(): readonly Character[] {
        return this._characters;
    }

    newCharacter(): Character {
        const c = new Character(this);
        this._characters.push(c);
        return c;
    }

    setupQuadTree(mapWidth: number, mapHeight: number): void {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        const boundary: IRectangle = { x: 0, z: 0, width: mapWidth, height: mapHeight };
        this.quadTree = new QuadTree<Character>(boundary, 8);
        for (const c of this._characters) {
            this.quadTree.insert(c);
        }
    }

    clear(): void {
        this._characters.length = 0;
        this.quadTree = undefined;
    }

    init(mapWidth: number, mapHeight: number, options: CrowdOptions = {}): void {
        if (!this.scene) return;

        const count = Math.min(10, options.count ?? 10);
        const childRatio = options.childRatio ?? 0.18;
        const worldUnitsPerMeter = 1 / appConstants.WorldUnitInMetre;

        const geometry = Character.createGeometry();
        const material = Character.createMaterial();
        this.crowdMesh = new THREE.InstancedMesh(geometry, material, count);
        this.crowdMesh.userData.selectableType = "character";
        this.crowdMesh.userData.characterResolver = (instanceId: number): Character | undefined => {
            return this._characters[instanceId];
        };
        this.scene.add(this.crowdMesh);

        const walkWeights = new Float32Array(count);
        const walkPhases = new Float32Array(count);
        const walkCadences = new Float32Array(count);
        const tempPos = new THREE.Vector3();
        const tempQuat = new THREE.Quaternion();
        const tempScale = new THREE.Vector3();
        const tempMatrix = new THREE.Matrix4();
        const yAxis = new THREE.Vector3(0, 1, 0);

        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;


        for (let i = 0; i < count; i++) {
            const character = this.newCharacter();
            character.x = Math.random() * (mapWidth - 1);
            character.z = Math.random() * (mapHeight - 1);
            character.heading = Math.random() * Math.PI * 2;
            //character.isWalking = true;
            const isChild = Math.random() < childRatio;
            character.scale = isChild ? appConstants.ChildHeightInMetre / appConstants.CharacterHeightInMetre : 1;
            const speed = isChild ? 1.0 + Math.random() * 0.5 : 1.2 + Math.random() * 0.6;
            character.speed = character.isBlocked ? 0 : speed * worldUnitsPerMeter;

            tempPos.set(character.x, 0, character.z);
            tempQuat.setFromAxisAngle(yAxis, character.heading);
            tempScale.set(character.scale, character.scale, character.scale);
            tempMatrix.compose(tempPos, tempQuat, tempScale);
            this.crowdMesh.setMatrixAt(i, tempMatrix);
            character.writeInstanceAnimationData(i, walkWeights, walkPhases, walkCadences);
        }

        geometry.setAttribute("aWalk", new THREE.InstancedBufferAttribute(walkWeights, 1));
        geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(walkPhases, 1));
        geometry.setAttribute("aCadence", new THREE.InstancedBufferAttribute(walkCadences, 1));
        this.crowdMesh.instanceMatrix.needsUpdate = true;

        this.setupQuadTree(mapWidth, mapHeight);
    }

    tick(elapsed: number): void {
        Character.updateAnimation(elapsed);
        if (!this.crowdMesh) return;

        const walkAttribute = this.crowdMesh.geometry.getAttribute("aWalk") as THREE.InstancedBufferAttribute | undefined;
        const delta = this.lastElapsed === 0 ? 0 : elapsed - this.lastElapsed;
        this.lastElapsed = elapsed;
        if (delta <= 0) return;

        for (let i = 0; i < this._characters.length; i++) {
            const character = this._characters[i];
            character.tick(delta, i, walkAttribute, this.crowdMesh);
        }

        if (walkAttribute) walkAttribute.needsUpdate = true;
        this.crowdMesh.instanceMatrix.needsUpdate = true;
    }

    dispose(): void {
        if (this.crowdMesh && this.scene) {
            this.scene.remove(this.crowdMesh);
            this.crowdMesh.geometry.dispose();
            const mat = this.crowdMesh.material;
            if (Array.isArray(mat)) mat.forEach(m => m.dispose());
            else mat.dispose();
            this.crowdMesh = undefined;
        }

        this.clear();
        this.lastElapsed = 0;
    }
}
