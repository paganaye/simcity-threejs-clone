import * as THREE from 'three';
import type { IRoadCuts } from './RoadCuts';
import { RoadPrimitive } from './RoadPrimitive';
import type { IRoadType } from './IRoad';
import { getBands } from './RoadLayout';
import type { IPoint2D } from '../../sim/IPoint';
import { RoadConstants } from '../textures/RoadBand';
import { RoadTextureBuilder } from '../textures/RoadTextureBuilder';

// Represents a curved single road segment defined by start, mid, and end points.
//  The curve is a circular arc passing through these three points.
export class CurvedRoadPrimitive extends RoadPrimitive {
    mid: IPoint2D;

    private static createRoadMesh(primitive: CurvedRoadPrimitive): THREE.Mesh | null {
        const geometry = primitive.createGeometry();
        if (!geometry) return null;
        const material = RoadTextureBuilder.getRoadMaterial(primitive.roadType);
        return new THREE.Mesh(geometry, material);
    }

    constructor(params: {
        transient: boolean;
        direction: 'forward' | 'backward';
        start: IPoint2D;
        mid: IPoint2D;
        end: IPoint2D;
        roadType: IRoadType;
        cuts?: IRoadCuts;
    }) {
        super(params);
        this.mid = params.mid;
    }

    private getArcData(): {
        center: IPoint2D;
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

    override createGeometry(): THREE.BufferGeometry | null {
        const y = 0, textureProgressV = 0, lineLength = RoadConstants.yellowLineLength, segmentLength = 2;
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

    private buildMesh(): THREE.Mesh | null {
        return CurvedRoadPrimitive.createRoadMesh(this);
    }

    override createMesh(scene: THREE.Object3D): void {
        this.replaceMesh(scene, this.buildMesh());
    }
}
