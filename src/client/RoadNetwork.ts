import { RoadSegment } from './RoadSegment';

export class RoadNetwork {
    readonly segments: RoadSegment[] = [];

    registerSegment(segment: RoadSegment): RoadSegment {
        if (!this.segments.includes(segment)) {
            this.segments.push(segment);
        }
        return segment;
    }

    removeSegment(segment: RoadSegment): boolean {
        const index = this.segments.indexOf(segment);
        if (index < 0) return false;
        this.segments.splice(index, 1);
        segment.dispose();
        return true;
    }

    clear(): void {
        for (const segment of [...this.segments]) {
            segment.dispose();
        }
        this.segments.length = 0;
    }

    
    static findCrossJunction(
        first: RoadSegment,
        second: RoadSegment,
    ): { x: number; z: number; angle: number; mainRoad: ReturnType<RoadSegment['getIRoad']>; crossingRoad: ReturnType<RoadSegment['getIRoad']> } | null {
        if (first.arcMidX !== undefined || first.arcMidZ !== undefined) return null;
        if (second.arcMidX !== undefined || second.arcMidZ !== undefined) return null;

        const angleDelta = Math.abs(RoadNetwork.normalizeAngle(first.angle - second.angle));
        const rightAngleDelta = Math.abs(angleDelta - Math.PI / 2);
        if (rightAngleDelta > 0.2) {
            return null;
        }

        const intersection = RoadNetwork.segmentIntersection(
            { x: first.startX, z: first.startZ },
            { x: first.endX, z: first.endZ },
            { x: second.startX, z: second.startZ },
            { x: second.endX, z: second.endZ },
        );
        if (!intersection) {
            return null;
        }

        return {
            x: intersection.x,
            z: intersection.z,
            angle: first.angle,
            mainRoad: first.getIRoad(),
            crossingRoad: second.getIRoad(),
        };
    }

    static segmentIntersection(
        a0: { x: number; z: number },
        a1: { x: number; z: number },
        b0: { x: number; z: number },
        b1: { x: number; z: number },
    ): { x: number; z: number } | null {
        const r = { x: a1.x - a0.x, z: a1.z - a0.z };
        const s = { x: b1.x - b0.x, z: b1.z - b0.z };
        const denominator = r.x * s.z - r.z * s.x;
        if (Math.abs(denominator) < 1e-6) {
            return null;
        }

        const qp = { x: b0.x - a0.x, z: b0.z - a0.z };
        const t = (qp.x * s.z - qp.z * s.x) / denominator;
        const u = (qp.x * r.z - qp.z * r.x) / denominator;
        const epsilon = 1e-4;
        if (t <= epsilon || t >= 1 - epsilon || u <= epsilon || u >= 1 - epsilon) {
            return null;
        }

        return {
            x: a0.x + t * r.x,
            z: a0.z + t * r.z,
        };
    }

    static normalizeAngle(angle: number): number {
        let normalized = angle;
        while (normalized > Math.PI) normalized -= Math.PI * 2;
        while (normalized <= -Math.PI) normalized += Math.PI * 2;
        return Math.abs(normalized);
    }

    
}
