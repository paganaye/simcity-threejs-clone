import * as THREE from 'three';
import type { IRoadCuts } from '../textures/RoadBuilder';
import type { IRoad } from './IRoad';
import { TwoWayRoadBuilder } from './TwoWayRoadBuilder';

const DEBUG_ROAD_ARC = true;

/**
 * A single straight road segment.
 * The group sits at (startX, 0, startZ) with rotation.y = angle.
 * Road geometry is built at local origin with angle=0;
 * the group's rotation handles world direction so moving/rotating
 * the group (via gizmo) needs no geometry rebuild.
 */
export class RoadSegment {
    readonly group = new THREE.Group();
    private iRoad: IRoad = {
        forward: { roadColor: 'old', lanes: 1, rightKerb: 'none', rightSidewalk: 'small', laneWidth: 'normal', leftKerb: 'none', leftSidewalk: 'none' },
        backward: { roadColor: 'old', lanes: 1, rightKerb: 'none', rightSidewalk: 'small', laneWidth: 'normal', leftKerb: 'none', leftSidewalk: 'none' },
        gapSize: 0
    };

    // Arc control point (world space). When set, road is rebuilt as a curve.
    private _arcMidX?: number;
    private _arcMidZ?: number;
    // Stored end position when arc is active (world space).
    private _arcEndX?: number;
    private _arcEndZ?: number;
    private junctionCuts?: { forwardCuts?: IRoadCuts; backwardCuts?: IRoadCuts };

    constructor(
        private readonly sceneRoot: THREE.Object3D,
        public startX: number,
        public startZ: number,
        public angle: number,
        public length: number,
        initialRoad?: IRoad,
    ) {
        if (initialRoad) {
            this.iRoad = {
                forward: { ...initialRoad.forward },
                backward: initialRoad.backward ? { ...initialRoad.backward } : undefined,
                gapSize: Number.isFinite(initialRoad.gapSize) ? initialRoad.gapSize : 0
            };
        }
        this.group.userData.selectableType = 'road';
        this.group.userData.roadSegment = this;
        this.group.userData.iRoad = this.iRoad;
        this.group.position.set(startX, 0, startZ);
        this.group.rotation.y = angle;
        sceneRoot.add(this.group);
        this.rebuild();
    }

    get endX(): number {
        return this._arcEndX ?? this.startX + Math.cos(this.angle) * this.length;
    }

    get endZ(): number {
        return this._arcEndZ ?? this.startZ - Math.sin(this.angle) * this.length;
    }

    get arcMidX(): number | undefined { return this._arcMidX; }
    get arcMidZ(): number | undefined { return this._arcMidZ; }

    getIRoad(): IRoad {
        return this.iRoad;
    }

    setIRoad(nextRoad: IRoad): void {
        this.iRoad = {
            forward: { ...nextRoad.forward },
            backward: nextRoad.backward ? { ...nextRoad.backward } : undefined,
            gapSize: Number.isFinite(nextRoad.gapSize) ? nextRoad.gapSize : 0,
        };
        this.group.userData.iRoad = this.iRoad;
        this.rebuild();
    }

    setJunctionCuts(cuts?: { forwardCuts?: IRoadCuts; backwardCuts?: IRoadCuts }): void {
        this.junctionCuts = cuts;
        this.rebuild();
    }

    getJunctionCuts(): { forwardCuts?: IRoadCuts; backwardCuts?: IRoadCuts } | undefined {
        return this.junctionCuts;
    }

    /** Curve the road through a world-space control point. Keeps start and end fixed. */
    setArc(midX: number, midZ: number, endX?: number, endZ?: number): void {
        if (endX !== undefined && endZ !== undefined) {
            this._arcEndX = endX;
            this._arcEndZ = endZ;
        } else if (this._arcEndX === undefined || this._arcEndZ === undefined) {
            this._arcEndX = this.startX + Math.cos(this.angle) * this.length;
            this._arcEndZ = this.startZ - Math.sin(this.angle) * this.length;
        }

        const targetEndX = this._arcEndX;
        const targetEndZ = this._arcEndZ;
        if (targetEndX === undefined || targetEndZ === undefined) return;

        // If arc control returns near the straight chord, switch back to true straight mode.
        const chordDx = targetEndX - this.startX;
        const chordDz = targetEndZ - this.startZ;
        const chordLength = Math.hypot(chordDx, chordDz);
        if (chordLength > 1e-6) {
            const ux = chordDx / chordLength;
            const uz = chordDz / chordLength;
            const nx = -uz;
            const nz = ux;
            const mx = midX - this.startX;
            const mz = midZ - this.startZ;
            const perpendicularDistance = Math.abs(mx * nx + mz * nz);
            const straightThreshold = Math.max(0.2, chordLength * 0.02);

            if (perpendicularDistance <= straightThreshold) {
                this.#setStraightFromEndpoints(targetEndX, targetEndZ);
                this.rebuild();
                return;
            }
        }

        this._arcMidX = midX;
        this._arcMidZ = midZ;
        this.rebuild();
    }

    #setStraightFromEndpoints(endX: number, endZ: number): void {
        const dx = endX - this.startX;
        const dz = endZ - this.startZ;
        this.length = Math.hypot(dx, dz);
        this.angle = Math.atan2(-dz, dx);
        this._arcMidX = undefined;
        this._arcMidZ = undefined;
        this._arcEndX = undefined;
        this._arcEndZ = undefined;
    }

    /** Move without rebuilding geometry — group transform handles world position. */
    moveTo(startX: number, startZ: number, angle: number): void {
        this.startX = startX;
        this.startZ = startZ;
        this.angle = angle;
        this._arcMidX = undefined;
        this._arcMidZ = undefined;
        this._arcEndX = undefined;
        this._arcEndZ = undefined;
        this.group.position.set(startX, 0, startZ);
        this.group.rotation.y = angle;
    }

    /** Change length and rebuild geometry. Clears any arc. */
    resize(newLength: number): void {
        this._arcMidX = undefined;
        this._arcMidZ = undefined;
        this._arcEndX = undefined;
        this._arcEndZ = undefined;
        this.length = newLength;
        this.rebuild();
    }

    /** Rebuild road meshes. Uses arc if control point is set, straight road otherwise. */
    rebuild(): void {
        this.#clearGeometry();

        if (this._arcMidX !== undefined && this._arcMidZ !== undefined &&
            this._arcEndX !== undefined && this._arcEndZ !== undefined) {
            this.#rebuildArc(this._arcMidX, this._arcMidZ, this._arcEndX, this._arcEndZ);
        } else {
            this.group.position.set(this.startX, 0, this.startZ);
            this.group.rotation.y = this.angle;
            const builder = new TwoWayRoadBuilder({ x: 0, y: 0.015, z: 0, angle: 0 }, this.group);
            builder.advanceRoad(this.length, this.iRoad, this.junctionCuts);
        }

        this.#tagChildren();
    }

    dispose(): void {
        this.#clearGeometry();
        this.sceneRoot.remove(this.group);
    }

    #clearGeometry(): void {
        while (this.group.children.length > 0) {
            const child = this.group.children[0] as THREE.Mesh;
            if (child.geometry) child.geometry.dispose();
            this.group.remove(child);
        }
    }

    #tagChildren(): void {
        this.group.traverse((obj) => {
            if (obj !== this.group) {
                obj.userData.selectableType = 'road';
                obj.userData.roadSegment = this;
            }
        });
    }

    /**
     * Rebuild as a circular arc through (startX,startZ), mid, end.
     * The group is placed at world-space identity so builder coords are world coords.
     */
    #rebuildArc(midX: number, midZ: number, endX: number, endZ: number): void {
        const p1x = this.startX, p1z = this.startZ;
        const p2x = midX, p2z = midZ;
        const p3x = endX, p3z = endZ;

        // Circumcircle of three world points.
        const D = 2 * (p1x * (p2z - p3z) + p2x * (p3z - p1z) + p3x * (p1z - p2z));
        if (Math.abs(D) < 0.01) {
            if (DEBUG_ROAD_ARC) {
                console.log('[RoadArc] fallback-straight', {
                    segmentId: this.group.id,
                    determinant: D,
                });
            }
            // Points nearly collinear — fall back to straight road.
            this.#setStraightFromEndpoints(p3x, p3z);
            this.group.position.set(this.startX, 0, this.startZ);
            this.group.rotation.y = this.angle;
            const b = new TwoWayRoadBuilder({ x: 0, y: 0.015, z: 0, angle: 0 }, this.group);
            b.advanceRoad(this.length, this.iRoad, this.junctionCuts);
            return;
        }

        const w1 = p1x * p1x + p1z * p1z;
        const w2 = p2x * p2x + p2z * p2z;
        const w3 = p3x * p3x + p3z * p3z;
        const cx = (w1 * (p2z - p3z) + w2 * (p3z - p1z) + w3 * (p1z - p2z)) / D;
        const cz = (w1 * (p3x - p2x) + w2 * (p1x - p3x) + w3 * (p2x - p1x)) / D;
        const radius = Math.hypot(p1x - cx, p1z - cz);

        // Compute angles in builder-space (x, -z) to match RoadBuilder conventions.
        const a1 = Math.atan2(-(p1z - cz), p1x - cx);
        const a2 = Math.atan2(-(p2z - cz), p2x - cx);
        const a3 = Math.atan2(-(p3z - cz), p3x - cx);

        const normalizeSigned = (angle: number): number => {
            let a = angle;
            while (a > Math.PI) a -= 2 * Math.PI;
            while (a <= -Math.PI) a += 2 * Math.PI;
            return a;
        };

        const positiveDelta = (from: number, to: number): number => {
            let d = to - from;
            while (d < 0) d += 2 * Math.PI;
            while (d >= 2 * Math.PI) d -= 2 * Math.PI;
            return d;
        };

        const negativeDelta = (from: number, to: number): number => {
            let d = from - to;
            while (d < 0) d += 2 * Math.PI;
            while (d >= 2 * Math.PI) d -= 2 * Math.PI;
            return d;
        };

        // Candidate 1: shortest signed arc from start to end.
        const shortDelta = normalizeSigned(a3 - a1);
        // Candidate 2: opposite wrapping arc with same endpoints.
        const longDelta = shortDelta > 0 ? shortDelta - 2 * Math.PI : shortDelta + 2 * Math.PI;

        const isOnArc = (start: number, mid: number, delta: number): boolean => {
            if (delta > 0) {
                const total = positiveDelta(start, start + delta);
                const toMid = positiveDelta(start, mid);
                return toMid <= total + 1e-6;
            }
            const total = negativeDelta(start, start + delta);
            const toMid = negativeDelta(start, mid);
            return toMid <= total + 1e-6;
        };

        let turnAngle = isOnArc(a1, a2, shortDelta) ? shortDelta : longDelta;
        if (!isOnArc(a1, a2, turnAngle)) {
            // Fallback for numeric edge-cases: prefer the shortest arc.
            turnAngle = shortDelta;
        }

        const startAngle = a1 + (turnAngle > 0 ? Math.PI / 2 : -Math.PI / 2);
        const arcAngle = Math.abs(turnAngle);


        // Build at world-space identity so builder positions are world coordinates.
        this.group.position.set(0, 0, 0);
        this.group.rotation.set(0, 0, 0);

        const builder = new TwoWayRoadBuilder({ x: p1x, y: 0.015, z: p1z, angle: startAngle }, this.group);
        builder.addCurvedRoad(turnAngle, radius, this.iRoad);

        // Keep stored state consistent with the arc geometry.
        this.angle = startAngle;
        this.length = arcAngle * radius;
    }
}
