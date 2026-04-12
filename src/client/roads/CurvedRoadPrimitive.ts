import * as THREE from 'three';
import type { IRoadCuts } from './RoadCuts';
import { IPointXZ } from './RoadPrimitiveCompiler';
import { RoadPrimitive } from './RoadPrimitive';
import type { IRoadType } from './IRoad';
import { getBands } from './RoadLayout';
import type { IOrientation2D } from '../../sim/IPoint';

// Represents a curved single road segment defined by start, mid, and end points.
//  The curve is a circular arc passing through these three points.
export class CurvedRoadPrimitive extends RoadPrimitive {
    mid: IPointXZ;

    static createRoadMesh(params: {
        start: IOrientation2D;
        radius: number;
        sweepAngle: number;
        roadType: IRoadType;
        material: THREE.Material;
        cuts?: IRoadCuts;
        y?: number;
        textureProgressV?: number;
        lineLength?: number;
        segments?: number;
        segmentLength?: number;
    }): THREE.Mesh | null {
        const {
            start,
            radius,
            sweepAngle,
            roadType,
            material,
            cuts,
            y = 0,
            textureProgressV = 0,
            lineLength = 8,
            segments,
            segmentLength = 2,
        } = params;

        const safeRadius = Math.max(0.001, Math.abs(radius));
        const safeSweepAngle = Number.isFinite(sweepAngle) ? sweepAngle : 0;
        if (Math.abs(safeSweepAngle) < 1e-6) return null;

        const leftNormalX = Math.sin(start.angle);
        const leftNormalZ = Math.cos(start.angle);
        const turnDirection = safeSweepAngle < 0 ? -1 : 1;
        const center = {
            x: start.x + leftNormalX * safeRadius * turnDirection,
            z: start.z + leftNormalZ * safeRadius * turnDirection,
        };

        const curveSweepAngle = -safeSweepAngle;
        const radialSign = -turnDirection;
        const pointAt = (t: number) => {
            const tangentAngle = start.angle + curveSweepAngle * t;
            const leftN = { x: Math.sin(tangentAngle), z: Math.cos(tangentAngle) };
            return {
                x: center.x + leftN.x * radialSign * safeRadius,
                z: center.z + leftN.z * radialSign * safeRadius,
            };
        };

        const primitive = new CurvedRoadPrimitive({
            transient: false,
            direction: 'forward',
            start: pointAt(0),
            mid: pointAt(0.5),
            end: pointAt(1),
            roadType,
            cuts,
        });

        return primitive.createMesh({
            material,
            y,
            textureProgressV,
            lineLength,
            segmentLength: segments ? (safeRadius * Math.abs(curveSweepAngle)) / Math.max(2, segments) : segmentLength,
        });
    }

    constructor(params: {
        transient: boolean;
        direction: 'forward' | 'backward';
        start: IPointXZ;
        mid: IPointXZ;
        end: IPointXZ;
        roadType: IRoadType;
        cuts?: IRoadCuts;
    }) {
        super(params);
        this.mid = params.mid;
    }

    private getArcData(): {
        center: IPointXZ;
        radius: number;
        startAngle: number;
        sweepAngle: number;
    } | null {
        const a = this.start;
        const b = this.mid;
        const c = this.end;
        const d = 2 * (a.x * (b.z - c.z) + b.x * (c.z - a.z) + c.x * (a.z - b.z));
        if (Math.abs(d) < 1e-6) return null;

        const aa = a.x * a.x + a.z * a.z;
        const bb = b.x * b.x + b.z * b.z;
        const cc = c.x * c.x + c.z * c.z;

        const ux = (aa * (b.z - c.z) + bb * (c.z - a.z) + cc * (a.z - b.z)) / d;
        const uz = (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d;
        const radius = Math.hypot(a.x - ux, a.z - uz);
        if (!Number.isFinite(radius) || radius <= 1e-6) return null;

        const normalizeAngle = (value: number): number => {
            let result = value;
            while (result <= -Math.PI) result += Math.PI * 2;
            while (result > Math.PI) result -= Math.PI * 2;
            return result;
        };
        const positiveDelta = (from: number, to: number): number => {
            let delta = to - from;
            while (delta < 0) delta += Math.PI * 2;
            while (delta >= Math.PI * 2) delta -= Math.PI * 2;
            return delta;
        };

        const startAngle = Math.atan2(a.z - uz, a.x - ux);
        const midAngle = Math.atan2(b.z - uz, b.x - ux);
        const endAngle = Math.atan2(c.z - uz, c.x - ux);
        const ccwSweep = positiveDelta(startAngle, endAngle);
        const ccwToMid = positiveDelta(startAngle, midAngle);

        const sweepAngle = ccwToMid <= ccwSweep
            ? ccwSweep
            : -positiveDelta(endAngle, startAngle);

        return {
            center: { x: ux, z: uz },
            radius,
            startAngle: normalizeAngle(startAngle),
            sweepAngle: normalizeAngle(sweepAngle),
        };
    }

    override createGeometry(params: {
        y?: number;
        textureProgressV?: number;
        lineLength?: number;
        segmentLength?: number;
    } = {}): THREE.BufferGeometry | null {
        const { y = 0, textureProgressV = 0, lineLength = 8, segmentLength = 2 } = params;
        const arc = this.getArcData();
        if (!arc || Math.abs(arc.sweepAngle) < 1e-6) return null;

        const bands = getBands(this.roadType);
        const widthM = bands.totalWidthM;
        if (widthM <= 0) return null;

        const halfWidth = widthM / 2;
        const minInnerRadius = 0.2;
        const innerRadius = Math.max(minInnerRadius, arc.radius - halfWidth);
        const outerRadius = arc.radius + halfWidth;

        const safeSegmentLength = Math.max(0.1, segmentLength);
        const arcLength = arc.radius * Math.abs(arc.sweepAngle);
        const subdivisionCount = Math.max(2, Math.ceil(arcLength / safeSegmentLength));

        const vertices: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        for (let i = 0; i <= subdivisionCount; i++) {
            const t = i / subdivisionCount;
            const angle = arc.startAngle + arc.sweepAngle * t;
            const radial = { x: Math.cos(angle), z: Math.sin(angle) };

            const leftRadius = arc.sweepAngle > 0 ? innerRadius : outerRadius;
            const rightRadius = arc.sweepAngle > 0 ? outerRadius : innerRadius;
            const leftBoundary = {
                x: arc.center.x + radial.x * leftRadius,
                z: arc.center.z + radial.z * leftRadius,
            };
            const rightBoundary = {
                x: arc.center.x + radial.x * rightRadius,
                z: arc.center.z + radial.z * rightRadius,
            };

            const v = textureProgressV + (arcLength / lineLength) * t;
            vertices.push(leftBoundary.x, y, leftBoundary.z);
            uvs.push(1, v);
            vertices.push(rightBoundary.x, y, rightBoundary.z);
            uvs.push(0, v);
        }

        for (let i = 0; i < subdivisionCount; i++) {
            const aIndex = i * 2;
            const bIndex = aIndex + 1;
            const cIndex = aIndex + 2;
            const dIndex = aIndex + 3;
            indices.push(aIndex, cIndex, bIndex);
            indices.push(cIndex, dIndex, bIndex);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    }

    override createMesh(params: {
        material: THREE.Material;
        y?: number;
        textureProgressV?: number;
        lineLength?: number;
        segmentLength?: number;
        offsetM?: number;
    }): THREE.Mesh | null {
        const geometry = this.createGeometry({
            y: params.y,
            textureProgressV: params.textureProgressV,
            lineLength: params.lineLength,
            segmentLength: params.segmentLength,
        });
        if (!geometry) return null;
        return new THREE.Mesh(geometry, params.material);
    }
}
