import * as THREE from 'three';
import type { IRoadCuts } from './RoadCuts';
import { RoadPrimitive } from './RoadPrimitive';
import type { IRoadType } from './IRoad';
import type { RoadSegment } from './RoadSegment';
import { getBands } from './RoadLayout';
import { computeArcFromThreePoints, type IPoint2D } from '../../sim/Geometry';
import { RoadConstants } from '../textures/RoadBand';
import { RoadShaderMaterialBuilder } from '../textures/RoadShaderMaterialBuilder';

export interface CurvedRoadPrimitiveParams {
    parent: THREE.Object3D;
    segment?: RoadSegment;
    transient: boolean;
    start: IPoint2D;
    mid: IPoint2D;
    end: IPoint2D;
    roadType: IRoadType;
    lateralOffsetM?: number;
    cuts?: IRoadCuts;
}


// Represents a curved single road segment defined by start, mid, and end points.
//  The curve is a circular arc passing through these three points.
export class CurvedRoadPrimitive extends RoadPrimitive {

    mid: IPoint2D;
    lateralOffsetM: number;

    constructor(params: CurvedRoadPrimitiveParams) {
        super(params);
        this.mid = params.mid;
        this.lateralOffsetM = params.lateralOffsetM ?? 0;
        this.initializeMesh(params.parent);
    }

    protected createMesh(): THREE.Mesh | null {
        const geometry = this.createGeometry();
        if (!geometry) return null;
        const material = RoadShaderMaterialBuilder.getRoadMaterial(this.roadType);
        return new THREE.Mesh(geometry, material);
    }

    override createGeometry(): THREE.BufferGeometry | null {
        const y = 0, textureProgressV = 0, lineLength = RoadConstants.yellowLineLength, segmentLength = 2;
        const arc = computeArcFromThreePoints(this.entry, this.mid, this.exit);
        if (!arc || Math.abs(arc.sweepAngle) < 1e-6) return null;

        const bands = getBands(this.roadType);
        const widthM = bands.totalWidthM;
        if (widthM <= 0) return null;

        const halfWidth = widthM / 2;
        // Positive lateral offset means "right side" of the road direction.
        // For CCW arcs, right side is outward (larger radius).
        // For CW arcs, right side is inward (smaller radius).
        const radiusShift = arc.sweepAngle > 0 ? this.lateralOffsetM : -this.lateralOffsetM;
        const centerRadius = arc.radius + radiusShift;
        const minInnerRadius = 0.2;
        const safeCenterRadius = Math.max(minInnerRadius + halfWidth, centerRadius);
        const innerRadius = Math.max(minInnerRadius, safeCenterRadius - halfWidth);
        const outerRadius = safeCenterRadius + halfWidth;

        const safeSegmentLength = Math.max(0.1, segmentLength);
        const arcLength = safeCenterRadius * Math.abs(arc.sweepAngle);
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

}



