import * as THREE from 'three';
import { CurvedRoadPrimitive, CurvedRoadPrimitiveParams } from "./CurvedRoadPrimitive";
import { IRoadType } from "./IRoad";
import { PrimitiveEndPoint, RoadPrimitive } from "./RoadPrimitive";

const DEBUG_JOINING_ROAD = false;

export interface JoiningRoadPrimitiveParams extends CurvedRoadPrimitiveParams {
    radius: number;
    first: PrimitiveEndPoint;
    second: PrimitiveEndPoint;
    requestedRadius?: number;
}

export type JoiningPrimitiveOptions = {
    radius?: number;
};

export class JoiningRoadPrimitive extends CurvedRoadPrimitive {
    private readonly first: PrimitiveEndPoint;
    private readonly second: PrimitiveEndPoint;
    private readonly requestedRadius: number;
    private isRebuilding = false;
    private readonly debugParent: THREE.Object3D;
    private debugRequestedRadiusCircle: THREE.LineLoop | null = null;

    private static debug(message: string, data?: unknown): void {
        if (!DEBUG_JOINING_ROAD) return;
        if (data === undefined) {
            console.log(`[JoiningRoadPrimitive] ${message}`);
            return;
        }
        console.log(`[JoiningRoadPrimitive] ${message}`, data);
    }

    private static directionAwayFromSide(endpoint: PrimitiveEndPoint): { x: number; z: number } | null {
        const primitive = endpoint.primitive;
        const dx = primitive.endPos.x - primitive.startPos.x;
        const dz = primitive.endPos.z - primitive.startPos.z;
        const length = Math.hypot(dx, dz);
        if (!Number.isFinite(length) || length <= 1e-6) return null;
        return endpoint.side === 'entry'
            ? { x: dx / length, z: dz / length }
            : { x: -dx / length, z: -dz / length };
    }

    constructor(params: JoiningRoadPrimitiveParams) {
        super(params);
        this.mid = params.mid;
        this.debugParent = params.parent;
        this.first = params.first;
        this.second = params.second;
        this.requestedRadius = typeof params.requestedRadius === 'number' && Number.isFinite(params.requestedRadius)
            ? Math.max(0, Math.abs(params.requestedRadius))
            : Math.max(0, Math.abs(params.radius));
        console.log("new JoiningRoadPrimitive with requestedRadius", this.requestedRadius);
    }

    onRoadMoved(): void {
        if (this.isRebuilding) return;

        const next = JoiningRoadPrimitive.computeJoinGeometry(this.first, this.second, this.requestedRadius);
        if (!next) {
            JoiningRoadPrimitive.debug('onRoadMoved: geometry invalid, keeping current arc');
            super.onRoadMoved();
            return;
        }

        this.isRebuilding = true;
        try {
            this.updateDebugRequestedRadiusCircle(next.center, this.requestedRadius, next.mid.y + 0.05);

            JoiningRoadPrimitive.debug('onRoadMoved: applying join geometry', {
                requestedRadius: this.requestedRadius,
                actualRadius: next.actualRadius,
                centerX: Number(next.center.x.toFixed(3)),
                centerZ: Number(next.center.z.toFixed(3)),
                startX: Number(next.start.x.toFixed(3)),
                startZ: Number(next.start.z.toFixed(3)),
                endX: Number(next.end.x.toFixed(3)),
                endZ: Number(next.end.z.toFixed(3)),
                midX: Number(next.mid.x.toFixed(3)),
                midY: Number(next.mid.y.toFixed(3)),
                midZ: Number(next.mid.z.toFixed(3)),
            });
            if (this.first.side === 'entry') this.first.primitive.startPos = next.end;
            else this.first.primitive.endPos = next.end;
            if (this.second.side === 'entry') this.second.primitive.startPos = next.start;
            else this.second.primitive.endPos = next.start;

            this.first.primitive.recreateMesh();
            this.second.primitive.recreateMesh();

            this.startPos = next.start;
            this.mid = next.mid;
            this.endPos = next.end;
        } finally {
            this.isRebuilding = false;
        }

        super.onRoadMoved();
    }

    override onDispose(): void {
        console.log("disposing JoiningRoadPrimitive", this);
        this.disposeDebugRequestedRadiusCircle();

        if (this.first.side === 'entry' && this.first.primitive.startJoinPrimitive === this) {
            this.first.primitive.startJoinPrimitive = null;
        }
        if (this.first.side === 'exit' && this.first.primitive.endJoinPrimitive === this) {
            this.first.primitive.endJoinPrimitive = null;
        }
        if (this.second.side === 'entry' && this.second.primitive.startJoinPrimitive === this) {
            this.second.primitive.startJoinPrimitive = null;
        }
        if (this.second.side === 'exit' && this.second.primitive.endJoinPrimitive === this) {
            this.second.primitive.endJoinPrimitive = null;
        }
        super.onDispose();
    }


    private static disposeJoinAt(endpoint: PrimitiveEndPoint): void {
        if (endpoint.side === 'entry') {
            const join = endpoint.primitive.startJoinPrimitive;
            if (join) {
                join.dispose();
                endpoint.primitive.startJoinPrimitive = null;
            }
        } else if (endpoint.side === 'end') {
            const join = endpoint.primitive.endJoinPrimitive;
            if (join) {
                join.dispose();
                endpoint.primitive.endJoinPrimitive = null;
            }
        }
    }

    private static computeJoinGeometry(
        first: PrimitiveEndPoint,
        second: PrimitiveEndPoint,
        requestedRadius: number,
    ): {
        start: { x: number; z: number };
        end: { x: number; z: number };
        center: { x: number; z: number };
        mid: { x: number; y: number; z: number };
        actualRadius: number;
    } | null {
        const d1 = this.directionAwayFromSide(first);
        const d2 = this.directionAwayFromSide(second);
        if (!d1 || !d2) {
            this.debug('computeJoinGeometry: invalid direction vector', { d1, d2 });
            return null;
        }

        const p1 = first.primitive.getPoint(first.side);
        const p2 = second.primitive.getPoint(second.side);
        const det = d1.x * d2.z - d1.z * d2.x;
        if (Math.abs(det) <= 1e-6) {
            this.debug('computeJoinGeometry: parallel rays (det too small)', { det, p1, p2, d1, d2 });
            return null;
        }
        const t = ((p2.x - p1.x) * d2.z - (p2.z - p1.z) * d2.x) / det;
        const node = { x: p1.x + d1.x * t, z: p1.z + d1.z * t };
        const dot = THREE.MathUtils.clamp(d1.x * d2.x + d1.z * d2.z, -1, 1);
        const phi = Math.acos(dot);
        if (phi < 0.02 || phi > Math.PI - 0.02) {
            this.debug('computeJoinGeometry: invalid angle', { phi, dot });
            return null;
        }

        const tanHalf = Math.tan(phi / 2);
        if (!Number.isFinite(tanHalf) || tanHalf <= 1e-6) {
            this.debug('computeJoinGeometry: tan(phi/2) invalid', { tanHalf, phi });
            return null;
        }

        const firstOpposite = first.side === 'entry' ? first.primitive.endPos : first.primitive.startPos;
        const secondOpposite = second.side === 'entry' ? second.primitive.endPos : second.primitive.startPos;
        const firstMaxTrim = (firstOpposite.x - node.x) * d1.x + (firstOpposite.z - node.z) * d1.z;
        const secondMaxTrim = (secondOpposite.x - node.x) * d2.x + (secondOpposite.z - node.z) * d2.z;
        const maxTrim = Math.max(0, Math.min(firstMaxTrim, secondMaxTrim) - 0.001);
        const trim = THREE.MathUtils.clamp(requestedRadius / tanHalf, 0, maxTrim);
        if (!Number.isFinite(trim) || trim <= 1e-6) {
            this.debug('computeJoinGeometry: trim invalid', {
                trim,
                maxTrim,
                firstMaxTrim,
                secondMaxTrim,
                requestedRadius,
                tanHalf,
            });
            return null;
        }

        const actualRadius = trim * tanHalf;
        const end = { x: node.x + d1.x * trim, z: node.z + d1.z * trim };
        const start = { x: node.x + d2.x * trim, z: node.z + d2.z * trim };

        const turn = d1.x * d2.z - d1.z * d2.x;
        if (Math.abs(turn) <= 1e-6) {
            this.debug('computeJoinGeometry: turn too small', { turn });
            return null;
        }

        const normalLeft = (d: { x: number; z: number }) => ({ x: -d.z, z: d.x });
        const normalRight = (d: { x: number; z: number }) => ({ x: d.z, z: -d.x });

        const n1 = turn > 0 ? normalLeft(d1) : normalRight(d1);
        const n2 = turn > 0 ? normalRight(d2) : normalLeft(d2);

        const centerFromEnd = {
            x: end.x + n1.x * actualRadius,
            z: end.z + n1.z * actualRadius,
        };
        const centerFromStart = {
            x: start.x + n2.x * actualRadius,
            z: start.z + n2.z * actualRadius,
        };
        const centerMismatch = Math.hypot(centerFromEnd.x - centerFromStart.x, centerFromEnd.z - centerFromStart.z);
        if (!Number.isFinite(centerMismatch) || centerMismatch > Math.max(0.05, actualRadius * 0.05)) {
            this.debug('computeJoinGeometry: center mismatch too large', {
                centerMismatch,
                centerFromEnd,
                centerFromStart,
                actualRadius,
            });
            return null;
        }

        const center = {
            x: (centerFromEnd.x + centerFromStart.x) * 0.5,
            z: (centerFromEnd.z + centerFromStart.z) * 0.5,
        };
        const a1 = Math.atan2(end.z - center.z, end.x - center.x);
        const a2 = Math.atan2(start.z - center.z, start.x - center.x);
        let delta = a2 - a1;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta <= -Math.PI) delta += Math.PI * 2;
        if (Math.abs(delta) < 1e-6) {
            this.debug('computeJoinGeometry: sweep delta too small', { delta, a1, a2 });
            return null;
        }

        const mid = {
            x: center.x + Math.cos(a1 + delta / 2) * actualRadius,
            y: ((p1.y ?? 0) + (p2.y ?? 0)) / 2,
            z: center.z + Math.sin(a1 + delta / 2) * actualRadius,
        };

        this.debug('computeJoinGeometry: success', {
            requestedRadius,
            actualRadius,
            trim,
            phi,
            turn,
            nodeX: Number(node.x.toFixed(3)),
            nodeZ: Number(node.z.toFixed(3)),
            startX: Number(start.x.toFixed(3)),
            startZ: Number(start.z.toFixed(3)),
            endX: Number(end.x.toFixed(3)),
            endZ: Number(end.z.toFixed(3)),
            centerX: Number(center.x.toFixed(3)),
            centerZ: Number(center.z.toFixed(3)),
            delta,
        });

        return { start, end, center, mid, actualRadius };
    }

    private disposeDebugRequestedRadiusCircle(): void {
        if (!this.debugRequestedRadiusCircle) return;
        this.debugRequestedRadiusCircle.parent?.remove(this.debugRequestedRadiusCircle);
        this.debugRequestedRadiusCircle.geometry.dispose();
        const material = this.debugRequestedRadiusCircle.material;
        if (material instanceof THREE.Material) {
            material.dispose();
        }
        this.debugRequestedRadiusCircle = null;
    }

    private updateDebugRequestedRadiusCircle(
        center: { x: number; z: number },
        radius: number,
        y: number,
    ): void {
        if (!DEBUG_JOINING_ROAD) {
            this.disposeDebugRequestedRadiusCircle();
            return;
        }
        if (!Number.isFinite(radius) || radius <= 1e-6) {
            this.disposeDebugRequestedRadiusCircle();
            return;
        }

        const segments = 64;
        const points: THREE.Vector3[] = [];
        for (let i = 0; i < segments; i++) {
            const t = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(
                center.x + Math.cos(t) * radius,
                y,
                center.z + Math.sin(t) * radius,
            ));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        if (!this.debugRequestedRadiusCircle) {
            const material = new THREE.LineBasicMaterial({ color: 0xff2d55 });
            this.debugRequestedRadiusCircle = new THREE.LineLoop(geometry, material);
            this.debugRequestedRadiusCircle.renderOrder = 999;
            this.debugParent.add(this.debugRequestedRadiusCircle);
            return;
        }

        this.debugRequestedRadiusCircle.geometry.dispose();
        this.debugRequestedRadiusCircle.geometry = geometry;
    }

    static joinPrimitives(
        parent: THREE.Object3D,
        firstEndPoint: PrimitiveEndPoint,
        secondEndPoint: PrimitiveEndPoint,
        roadType: IRoadType,
        options: JoiningPrimitiveOptions = {},
    ): RoadPrimitive | null {
        this.disposeJoinAt(firstEndPoint);
        this.disposeJoinAt(secondEndPoint);

        const requestedRadius = typeof options.radius === 'number' && Number.isFinite(options.radius) ? Math.max(0, Math.abs(options.radius)) : 6;
        const geometry = this.computeJoinGeometry(firstEndPoint, secondEndPoint, requestedRadius);
        if (!geometry) return null;

        firstEndPoint.primitive.movePoint(firstEndPoint.side, geometry.end);
        secondEndPoint.primitive.movePoint(secondEndPoint.side, geometry.start);

        const result = new JoiningRoadPrimitive({
            parent,
            transient: true,
            start: geometry.start,
            mid: geometry.mid,
            end: geometry.end,
            roadType,
            radius: geometry.actualRadius,
            first: firstEndPoint,
            second: secondEndPoint,
            requestedRadius,
        });

        result.updateDebugRequestedRadiusCircle(geometry.center, requestedRadius, geometry.mid.y + 0.05);
        if (firstEndPoint.side === 'entry') firstEndPoint.primitive.startJoinPrimitive = result;
        else firstEndPoint.primitive.endJoinPrimitive = result;
        if (secondEndPoint.side === 'entry') secondEndPoint.primitive.startJoinPrimitive = result;
        else secondEndPoint.primitive.endJoinPrimitive = result;

        return result;
    }

}
