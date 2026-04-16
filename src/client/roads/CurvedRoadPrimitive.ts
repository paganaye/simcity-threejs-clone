import * as THREE from 'three';
import type { IRoadCuts } from './RoadCuts';
import { RoadLine, RoadPrimitive } from './RoadPrimitive';
import type { RoadSegment } from './RoadSegment';
import { computeArcFromThreePoints, EPSILON, IArc, IVector2D, type IPoint2D } from '../../sim/Geometry';
import { RoadConstants } from '../textures/RoadBand';
import { RoadShaderMaterialBuilder } from '../textures/RoadShaderMaterialBuilder';
import { RoadType } from './RoadType';
import { PrimitiveSide } from './PrimitiveEndPoint';
import { appConstants } from '../../AppConstants';

export interface CurvedRoadPrimitiveParams {
    parent: THREE.Object3D;
    segment?: RoadSegment;
    transient: boolean;
    start: IPoint2D;
    mid: IPoint2D;
    end: IPoint2D;
    roadType: RoadType;
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

    protected createMesh(): THREE.Object3D | null {
        const geometry = this.createGeometry();
        if (!geometry) return null;
        const material = RoadShaderMaterialBuilder.getRoadMaterial(this.roadType.roadType);
        const mesh = new THREE.Mesh(geometry, material);
        if (appConstants.DEBUG_ROAD) {
            this.createDebugGuideLines(mesh);
        }
        return mesh;
    }

    override createGeometry(): THREE.BufferGeometry | null {
        const y = 0, textureProgressV = 0, lineLength = RoadConstants.yellowLineLength, segmentLength = 2;
        const arc = computeArcFromThreePoints(this.entry, this.mid, this.exit);
        if (!arc || Math.abs(arc.sweepAngle) < 1e-6) return null;

        const widthM = this.roadType.outerWidth;
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


    getDirection(side: PrimitiveSide): IVector2D {
        const arc = computeArcFromThreePoints(this.entry, this.mid, this.exit);
        if (!arc || Math.abs(arc.sweepAngle) <= EPSILON) {
            const dx = this.exit.x - this.entry.x;
            const dz = this.exit.z - this.entry.z;
            const length = Math.hypot(dx, dz);
            if (!Number.isFinite(length) || length <= EPSILON) return { x: 0, z: 0 };
            return { x: dx / length, z: dz / length };
        }

        const angle = side === 'entry'
            ? arc.startAngle
            : arc.startAngle + arc.sweepAngle;
        const radial = { x: Math.cos(angle), z: Math.sin(angle) };

        return arc.sweepAngle > 0
            ? { x: -radial.z, z: radial.x }
            : { x: radial.z, z: -radial.x };
    }

    override getGeometry(line: RoadLine): IArc {
        const arc = computeArcFromThreePoints(this.entry, this.mid, this.exit);
        const fallbackRadius = Math.hypot(this.exit.x - this.entry.x, this.exit.z - this.entry.z) * 0.5;
        if (!arc) {
            return {
                center: { x: this.entry.x, z: this.entry.z },
                radius: Math.max(EPSILON, fallbackRadius),
                startAngle: 0,
                sweepAngle: 0,
            };
        }

        const offset = this.getLineLateralOffset(line);
        // Positive offset is to the right of travel direction.
        // On CCW arcs, right side is outward; on CW arcs, right side is inward.
        const signedOffset = arc.sweepAngle > 0 ? offset : -offset;
        return {
            center: arc.center,
            radius: Math.max(EPSILON, arc.radius + signedOffset),
            startAngle: arc.startAngle,
            sweepAngle: arc.sweepAngle,
        };
    }
}



