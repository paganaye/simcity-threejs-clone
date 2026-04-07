import * as THREE from 'three';
import { RoadBuilder } from './RoadBuilder';
import type { IRoad } from './roads/IRoad';

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
        type: 'TwoWayRoad',
        forwardWay: { roadColor: 'old', lanes: 1, rightKerb: 'none', rightSidewalk: 'small', laneWidth: 'normal', leftKerb: 'none', leftSidewalk: 'none' },
        otherWay:   { roadColor: 'old', lanes: 1, rightKerb: 'none', rightSidewalk: 'small', laneWidth: 'normal', leftKerb: 'none', leftSidewalk: 'none' },
        gapSize: 0,
    };

    // Arc control point (world space). When set, road is rebuilt as a curve.
    private _arcMidX?: number;
    private _arcMidZ?: number;
    // Stored end position when arc is active (world space).
    private _arcEndX?: number;
    private _arcEndZ?: number;

    constructor(
        private readonly sceneRoot: THREE.Object3D,
        public startX: number,
        public startZ: number,
        public angle: number,
        public length: number,
    ) {
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
        this.iRoad = nextRoad.type === 'OneWayRoad'
            ? {
                type: 'OneWayRoad',
                options: { ...nextRoad.options },
            }
            : {
                type: 'TwoWayRoad',
                forwardWay: { ...nextRoad.forwardWay },
                otherWay: { ...nextRoad.otherWay },
                gapSize: nextRoad.gapSize,
            };
        this.group.userData.iRoad = this.iRoad;
        this.rebuild();
    }

    /** Curve the road through a world-space control point. Keeps start and end fixed. */
    setArc(midX: number, midZ: number, endX?: number, endZ?: number): void {
        if (endX !== undefined && endZ !== undefined) {
            this._arcEndX = endX;
            this._arcEndZ = endZ;
        } else if (this._arcEndX === undefined) {
            this._arcEndX = this.startX + Math.cos(this.angle) * this.length;
            this._arcEndZ = this.startZ - Math.sin(this.angle) * this.length;
        }
        this._arcMidX = midX;
        this._arcMidZ = midZ;
        this.rebuild();
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
            const builder = new RoadBuilder({ x: 0, y: 0.015, z: 0, angle: 0 }, this.group);
            builder.addStraightRoadFromIRoad(this.length, this.iRoad);
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
        const p2x = midX,        p2z = midZ;
        const p3x = endX,        p3z = endZ;

        // Circumcircle of three world points.
        const D = 2 * (p1x * (p2z - p3z) + p2x * (p3z - p1z) + p3x * (p1z - p2z));
        if (Math.abs(D) < 0.01) {
            // Points nearly collinear — fall back to straight road.
            this.group.position.set(this.startX, 0, this.startZ);
            this.group.rotation.y = this.angle;
            const b = new RoadBuilder({ x: 0, y: 0.015, z: 0, angle: 0 }, this.group);
            b.addStraightRoadFromIRoad(this.length, this.iRoad);
            return;
        }

        const w1 = p1x * p1x + p1z * p1z;
        const w2 = p2x * p2x + p2z * p2z;
        const w3 = p3x * p3x + p3z * p3z;
        const cx = (w1 * (p2z - p3z) + w2 * (p3z - p1z) + w3 * (p1z - p2z)) / D;
        const cz = (w1 * (p3x - p2x) + w2 * (p1x - p3x) + w3 * (p2x - p1x)) / D;
        const radius = Math.hypot(p1x - cx, p1z - cz);

        // Is the mid point to the left or right of the chord start→end?
        // In the XZ plane: crossMid < 0 → left turn (positive turnAngle in RoadBuilder).
        const exChord = p3x - p1x, ezChord = p3z - p1z;
        const mxChord = p2x - p1x, mzChord = p2z - p1z;
        const crossMid = mxChord * ezChord - mzChord * exChord;
        const leftTurn = crossMid < 0;

        // Center-to-start vector.
        const csx = p1x - cx, csz = p1z - cz;

        // Start tangent: CW perp of center→start for left turn, CCW perp for right turn.
        const tx = leftTurn ? csz / radius : -csz / radius;
        const tz = leftTurn ? -csx / radius : csx / radius;
        const startAngle = Math.atan2(-tz, tx);

        // Arc angle at the circumcircle center.
        const a1 = Math.atan2(p1z - cz, p1x - cx);
        const a3 = Math.atan2(p3z - cz, p3x - cx);
        let rawDelta = a3 - a1;
        while (rawDelta > Math.PI)  rawDelta -= 2 * Math.PI;
        while (rawDelta < -Math.PI) rawDelta += 2 * Math.PI;

        // Arc angle magnitude (always positive) in the direction of travel.
        const arcAngle = leftTurn
            ? (rawDelta <= 0 ? -rawDelta : 2 * Math.PI - rawDelta)
            : (rawDelta >= 0 ?  rawDelta : 2 * Math.PI + rawDelta);

        const turnAngle = leftTurn ? arcAngle : -arcAngle;

        // Build at world-space identity so builder positions are world coordinates.
        this.group.position.set(0, 0, 0);
        this.group.rotation.set(0, 0, 0);

        const builder = new RoadBuilder({ x: p1x, y: 0.015, z: p1z, angle: startAngle }, this.group);
        builder.addTurningRoadFromIRoad(turnAngle, radius, this.iRoad);

        // Keep stored state consistent with the arc geometry.
        this.angle = startAngle;
        this.length = arcAngle * radius;
    }
}
