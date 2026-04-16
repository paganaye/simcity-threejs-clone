import type { IRoadCuts } from './RoadCuts';
import * as THREE from 'three';
import { RoadLine, RoadPrimitive } from './RoadPrimitive';
import type { RoadSegment } from './RoadSegment';
import { Vector, distance2D, midPoint, normalize2D, type IPoint2D, type IVector2D } from '../../sim/Geometry';
import { RoadConstants } from '../textures/RoadBand';
import { RoadShaderMaterialBuilder } from '../textures/RoadShaderMaterialBuilder';
import { appConstants } from '../../AppConstants';
import { RoadType } from './RoadType';
import { PrimitiveSide } from './PrimitiveEndPoint';

export interface StraightRoadPrimitiveParams {
    parent: THREE.Object3D;
    segment?: RoadSegment | undefined;
    transient: boolean;
    start: IPoint2D;
    end: IPoint2D;
    roadType: RoadType;
    cuts?: IRoadCuts;
}
export class StraightRoadPrimitive extends RoadPrimitive {
    constructor(params: StraightRoadPrimitiveParams) {
        super(params);
        this.initializeMesh(params.parent);
    }

    private static clampExtremityValue(value: number, length: number): number {
        if (!Number.isFinite(value)) return 0;
        return THREE.MathUtils.clamp(value, 0, length);
    }

    private static getExtremityValues(cut: IRoadCuts['entryCut'] | undefined, length: number): [number, number, number, number, number] {
        if (!cut) return [0, 0, 0, 0, 0];
        return [
            this.clampExtremityValue(cut.left, length),
            this.clampExtremityValue(cut.roadLeft, length),
            this.clampExtremityValue(cut.middle, length),
            this.clampExtremityValue(cut.roadRight, length),
            this.clampExtremityValue(cut.right, length),
        ];
    }

    private static pushUniquePoint(points: IPoint2D[], point: IPoint2D): void {
        const previous = points[points.length - 1];
        if (previous && Math.abs(previous.x - point.x) < 1e-6 && Math.abs(previous.z - point.z) < 1e-6) {
            return;
        }
        points.push(point);
    }

    private static getSideCutSegments(params: {
        cuts: IRoadCuts['rightCuts'] | undefined;
        length: number;
        overlapStartX: number;
        overlapEndX: number;
    }): NonNullable<IRoadCuts['rightCuts']> {
        const { cuts, length, overlapStartX, overlapEndX } = params;
        if (!cuts?.length || overlapEndX <= overlapStartX) return [];

        const toLocalX = (value: number): number => -length / 2 + this.clampExtremityValue(value, length);
        const normalizedCuts = [...cuts].sort((left, right) => left.from - right.from);
        const segments: NonNullable<IRoadCuts['rightCuts']> = [];
        let currentX = overlapStartX;

        for (const cut of normalizedCuts) {
            const from = Math.max(currentX, THREE.MathUtils.clamp(toLocalX(cut.from), overlapStartX, overlapEndX));
            const roadFrom = Math.max(from, THREE.MathUtils.clamp(toLocalX(cut.roadFrom), overlapStartX, overlapEndX));
            const roadTo = Math.max(roadFrom, THREE.MathUtils.clamp(toLocalX(cut.roadTo), overlapStartX, overlapEndX));
            const to = Math.max(roadTo, THREE.MathUtils.clamp(toLocalX(cut.to), overlapStartX, overlapEndX));

            if (to <= from) continue;

            segments.push({ from, roadFrom, roadTo, to });
            currentX = to;
        }

        return segments;
    }

    private createCutGeometry(params: {
        length: number;
        widthM: number;
        carriagewayStartM: number;
        carriagewayEndM: number;
        startV: number;
        endV: number;
        dirX: number;
        dirZ: number;
        latX: number;
        latZ: number;
        midX: number;
        midZ: number;
        y: number;
    }): THREE.BufferGeometry {
        const {
            length,
            widthM,
            carriagewayStartM,
            carriagewayEndM,
            startV,
            endV,
            dirX,
            dirZ,
            latX,
            latZ,
            midX,
            midZ,
            y,
        } = params;
        const halfLength = length / 2;
        const leftOuter = widthM / 2;
        const roadLeft = leftOuter - carriagewayStartM;
        const middle = (roadLeft + (leftOuter - carriagewayEndM)) * 0.5;
        const roadRight = leftOuter - carriagewayEndM;
        const rightOuter = -widthM / 2;
        const lateral = [leftOuter, roadLeft, middle, roadRight, rightOuter];

        const startCuts = StraightRoadPrimitive.getExtremityValues(this.cuts?.entryCut, length);
        const endCuts = StraightRoadPrimitive.getExtremityValues(this.cuts?.exitCut, length);
        const repeat = endV - startV;

        const startX = lateral.map((_, index) => -halfLength + startCuts[index]);
        const endX = lateral.map((_, index) => halfLength - endCuts[index]);

        const rightSegments = StraightRoadPrimitive.getSideCutSegments({
            cuts: this.cuts?.rightCuts,
            length,
            overlapStartX: Math.max(startX[3], startX[4]),
            overlapEndX: Math.min(endX[3], endX[4]),
        });
        const leftSegments = StraightRoadPrimitive.getSideCutSegments({
            cuts: this.cuts?.leftCuts,
            length,
            overlapStartX: Math.max(startX[0], startX[1]),
            overlapEndX: Math.min(endX[0], endX[1]),
        });

        const outline: IPoint2D[] = [];
        const startEdge: IPoint2D[] = [
            { x: startX[0], z: leftOuter },
            { x: startX[1], z: roadLeft },
            { x: startX[2], z: middle },
            { x: startX[3], z: roadRight },
            { x: startX[4], z: rightOuter },
        ];
        const endEdge: IPoint2D[] = [
            { x: endX[4], z: rightOuter },
            { x: endX[3], z: roadRight },
            { x: endX[2], z: middle },
            { x: endX[1], z: roadLeft },
            { x: endX[0], z: leftOuter },
        ];

        for (const point of startEdge) {
            StraightRoadPrimitive.pushUniquePoint(outline, point);
        }

        let rightBoundaryX = startX[4];
        for (const cut of rightSegments) {
            if (cut.from > rightBoundaryX) {
                StraightRoadPrimitive.pushUniquePoint(outline, { x: cut.from, z: rightOuter });
            }
            StraightRoadPrimitive.pushUniquePoint(outline, { x: cut.roadFrom, z: roadRight });
            StraightRoadPrimitive.pushUniquePoint(outline, { x: cut.roadTo, z: roadRight });
            StraightRoadPrimitive.pushUniquePoint(outline, { x: cut.to, z: rightOuter });
            rightBoundaryX = cut.to;
        }
        StraightRoadPrimitive.pushUniquePoint(outline, { x: endX[4], z: rightOuter });

        for (const point of endEdge) {
            StraightRoadPrimitive.pushUniquePoint(outline, point);
        }

        let leftBoundaryX = endX[0];
        for (let index = leftSegments.length - 1; index >= 0; index--) {
            const cut = leftSegments[index];
            if (cut.to < leftBoundaryX) {
                StraightRoadPrimitive.pushUniquePoint(outline, { x: cut.to, z: leftOuter });
            }
            StraightRoadPrimitive.pushUniquePoint(outline, { x: cut.roadTo, z: roadLeft });
            StraightRoadPrimitive.pushUniquePoint(outline, { x: cut.roadFrom, z: roadLeft });
            StraightRoadPrimitive.pushUniquePoint(outline, { x: cut.from, z: leftOuter });
            leftBoundaryX = cut.from;
        }
        StraightRoadPrimitive.pushUniquePoint(outline, { x: startX[0], z: leftOuter });

        if (outline.length > 1) {
            const first = outline[0];
            const last = outline[outline.length - 1];
            if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.z - last.z) < 1e-6) {
                outline.pop();
            }
        }

        const contour = outline.map((point) => new THREE.Vector2(point.x, point.z));
        if (THREE.ShapeUtils.isClockWise(contour)) {
            contour.reverse();
        }

        const faces = THREE.ShapeUtils.triangulateShape(contour, []);
        const vertices: number[] = [];
        const uvs: number[] = [];
        for (const point of contour) {
            const t = THREE.MathUtils.clamp((point.x + halfLength) / length, 0, 1);
            const u = THREE.MathUtils.clamp((leftOuter - point.y) / widthM, 0, 1);
            // point.x = along road, point.y = lateral — transform to world XZ
            vertices.push(
                midX + dirX * point.x + latX * point.y,
                y,
                midZ + dirZ * point.x + latZ * point.y,
            );
            uvs.push(u, startV + repeat * t);
        }

        const indices: number[] = [];
        for (const face of faces) {
            indices.push(face[0], face[1], face[2]);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return geometry;
    }

    override createGeometry(params: {
        y?: number;
        textureProgressV?: number;
        lineLength?: number;
        segmentLength?: number;
    } = {}): THREE.BufferGeometry | null {
        const { textureProgressV = 0, lineLength = RoadConstants.yellowLineLength } = params;
        const length = distance2D(this.entry, this.exit);
        if (length <= 0) return null;

        const direction = normalize2D({
            x: this.exit.x - this.entry.x,
            z: this.exit.z - this.entry.z,
        });
        if (!direction) return null;

        const widthM = this.roadType.outerWidth;
        if (widthM <= 0) return null;

        // World-space orientation
        const dirX = direction.x;
        const dirZ = direction.z;
        const latX = dirZ;   // perpendicular right
        const latZ = -dirX;
        const carriagewayCenter = (this.roadType.carriagewayStart + this.roadType.carriagewayEnd) / 2;
        const lateralOffsetM = carriagewayCenter - widthM / 2;
        const center = midPoint(this.entry, this.exit);
        const midX = center.x + latX * lateralOffsetM;
        const midZ = center.z + latZ * lateralOffsetM;
        const y = this.entry.y ?? 0;

        const startV = textureProgressV;
        const endV = startV + length / lineLength;
        const hasCustomCuts = Boolean(this.cuts?.entryCut || this.cuts?.exitCut || this.cuts?.rightCuts?.length || this.cuts?.leftCuts?.length);
        if (!hasCustomCuts) {
            // Generate 4 corners directly in world XZ — no rotation needed
            const halfLen = length / 2;
            const halfWidth = widthM / 2;
            const positions: number[] = [];
            const pushWorld = (along: number, lat: number) =>
                positions.push(midX + dirX * along + latX * lat, y, midZ + dirZ * along + latZ * lat);
            pushWorld(-halfLen,  halfWidth);  // 0: entry, left
            pushWorld(-halfLen, -halfWidth);  // 1: entry, right
            pushWorld( halfLen,  halfWidth);  // 2: exit,  left
            pushWorld( halfLen, -halfWidth);  // 3: exit,  right
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, startV, 1, startV, 0, endV, 1, endV], 2));
            geometry.setIndex([0, 2, 1, 2, 3, 1]);
            geometry.computeVertexNormals();
            return geometry;
        }

        return this.createCutGeometry({
            length, widthM,
            carriagewayStartM: this.roadType.carriagewayStart,
            carriagewayEndM: this.roadType.carriagewayEnd,
            startV, endV,
            dirX, dirZ, latX, latZ, midX, midZ, y,
        });
    }

    protected override createMesh(): THREE.Object3D | null {
        const geometry = this.createGeometry();
        if (!geometry) return null;
        const material = RoadShaderMaterialBuilder.getRoadMaterial(this.roadType.roadType);
        const mesh = new THREE.Mesh(geometry, material);
        if (appConstants.DEBUG_ROAD) {
            this.createDebugGuideLines(mesh);
        }
        return mesh;
    }

    getDirection(_side: PrimitiveSide): IVector2D {
        return normalize2D({
            x: this.exit.x - this.entry.x,
            z: this.exit.z - this.entry.z,
        }) ?? { x: 0, z: 0 };
    }

    override getGeometry(line: RoadLine) {
        const offset = this.getLineLateralOffset(line);
        const direction = this.getDirection('entry');
        const right = Vector.rightAngle(direction);
        return {
            entry: {
                x: this.entry.x + right.x * offset,
                y: this.entry.y,
                z: this.entry.z + right.z * offset,
            },
            exit: {
                x: this.exit.x + right.x * offset,
                y: this.exit.y,
                z: this.exit.z + right.z * offset,
            },
        };
    }
}
