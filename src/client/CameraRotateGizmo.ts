import * as THREE from 'three';

const POSITION_SMOOTHING = 20;
const BASE_SCALE = 0.035;
const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;

export class CameraRotateGizmo {
    readonly root = new THREE.Group();

    readonly targetPosition = new THREE.Vector3();
    readonly displayPosition = new THREE.Vector3();

    private readonly markerMaterials: THREE.MeshBasicMaterial[] = [];

    constructor(scene: THREE.Scene) {
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: 0xffd166,
            transparent: true,
            opacity: 1,
            depthTest: false,
        });

        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x5eead4,
            transparent: true,
            opacity: 1,
            depthTest: false,
            side: THREE.DoubleSide,
        });

        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), sphereMaterial);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 8, 32), ringMaterial);
        ring.rotation.x = Math.PI / 2;

        const northMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4d4f,
            transparent: true,
            opacity: 1,
            depthTest: false,
        });
        const eastMaterial = new THREE.MeshBasicMaterial({
            color: 0x4dabf7,
            transparent: true,
            opacity: 1,
            depthTest: false,
        });

        const northNeedle = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 10), northMaterial);
        northNeedle.position.set(0, 0.02, 0.52);
        northNeedle.rotation.x = Math.PI;

        const eastNeedle = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 10), eastMaterial);
        eastNeedle.position.set(0.52, 0.02, 0);
        eastNeedle.rotation.z = -Math.PI / 2;

        this.root.add(sphere, ring, northNeedle, eastNeedle);
        this.root.visible = false;
        this.root.renderOrder = 2000;

        this.markerMaterials.push(sphereMaterial, ringMaterial, northMaterial, eastMaterial);

        scene.add(this.root);
    }

    setTarget(position: THREE.Vector3) {
        this.targetPosition.copy(position);
        this.displayPosition.copy(position);
        this.root.position.copy(position);
        this.root.visible = true;
    }

    hide() {
        this.root.visible = false;
    }

    update(deltaSeconds: number, camera: THREE.Camera) {
        if (!this.root.visible) return;

        const alpha = 1 - Math.exp(-POSITION_SMOOTHING * deltaSeconds);
        this.displayPosition.lerp(this.targetPosition, alpha);
        this.root.position.copy(this.displayPosition);

        const distance = this.displayPosition.distanceTo((camera as THREE.PerspectiveCamera).position);
        const gizmoScale = THREE.MathUtils.clamp(distance * BASE_SCALE, MIN_SCALE, MAX_SCALE);
        this.root.scale.setScalar(gizmoScale);

        this.root.rotation.y += deltaSeconds * 1.8;
    }

    dispose() {
        this.root.removeFromParent();
        for (const child of this.root.children) {
            const mesh = child as THREE.Mesh;
            mesh.geometry?.dispose();
        }
        for (const material of this.markerMaterials) {
            material.dispose();
        }
    }
}
