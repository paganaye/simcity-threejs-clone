import * as THREE from 'three';
import { RoadBuilder, RoadType } from './RoadBuilder';

/**
 * A single straight road segment.
 * The group sits at (startX, 0, startZ) with rotation.y = angle.
 * Road geometry is built at local origin with angle=0;
 * the group's rotation handles world direction so moving/rotating
 * the group (via gizmo) needs no geometry rebuild.
 */
export class RoadSegment {
    readonly group = new THREE.Group();

    constructor(
        private readonly sceneRoot: THREE.Object3D,
        public startX: number,
        public startZ: number,
        public angle: number,
        public length: number,
        public roadType: RoadType = 'l1',
    ) {
        this.group.userData.selectableType = 'road';
        this.group.userData.roadSegment = this;
        this.group.position.set(startX, 0, startZ);
        this.group.rotation.y = angle;
        sceneRoot.add(this.group);
        this.rebuild();
    }

    get endX(): number {
        return this.startX + Math.cos(this.angle) * this.length;
    }

    get endZ(): number {
        return this.startZ - Math.sin(this.angle) * this.length;
    }

    /** Move without rebuilding geometry — group transform handles world position. */
    moveTo(startX: number, startZ: number, angle: number): void {
        this.startX = startX;
        this.startZ = startZ;
        this.angle = angle;
        this.group.position.set(startX, 0, startZ);
        this.group.rotation.y = angle;
    }

    /** Change length and rebuild geometry. */
    resize(newLength: number): void {
        this.length = newLength;
        this.rebuild();
    }

    /** Rebuild road meshes at local origin (angle=0); group rotation handles direction. */
    rebuild(): void {
        while (this.group.children.length > 0) {
            const child = this.group.children[0] as THREE.Mesh;
            if (child.geometry) child.geometry.dispose();
            this.group.remove(child);
        }

        const builder = new RoadBuilder(
            { x: 0, y: 0.015, z: 0, angle: 0 },
            this.group,
        );
        builder.addStraightRoad(this.length, this.roadType);

        // Tag children so gizmo can pick them
        this.group.traverse((obj) => {
            if (obj !== this.group) {
                obj.userData.selectableType = 'road';
                obj.userData.roadSegment = this;
            }
        });
    }

    dispose(): void {
        while (this.group.children.length > 0) {
            const child = this.group.children[0] as THREE.Mesh;
            if (child.geometry) child.geometry.dispose();
            this.group.remove(child);
        }
        this.sceneRoot.remove(this.group);
    }
}
