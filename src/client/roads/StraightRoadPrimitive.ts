import type { IRoadCuts } from './RoadCuts';
import * as THREE from 'three';
import { RoadPrimitive } from './RoadPrimitive';
import type { IRoadType } from './IRoad';
import { getBands } from './RoadLayout';
import type { IPoint2D } from '../../sim/IPoint';
import { RoadConstants } from '../textures/RoadBand';
import { RoadTextureBuilder } from '../textures/RoadTextureBuilder';

export interface StraightRoadPrimitiveParams {
    parent: THREE.Object3D;
    transient: boolean;
    start: IPoint2D;
    end: IPoint2D;
    roadType: IRoadType;
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

    private static getExtremityValues(cut: IRoadCuts['startCut'] | undefined, length: number): [number, number, number, number] {
        if (!cut) return [0, 0, 0, 0];
        return [
            this.clampExtremityValue(cut.left, length),
            this.clampExtremityValue(cut.roadLeft, length),
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
    }): THREE.BufferGeometry {
        const {
            length,
            widthM,
            carriagewayStartM,
            carriagewayEndM,
            startV,
            endV,
        } = params;
        const halfLength = length / 2;
        const leftOuter = widthM / 2;
        const roadLeft = leftOuter - carriagewayStartM;
        const roadRight = leftOuter - carriagewayEndM;
        const rightOuter = -widthM / 2;
        const lateral = [leftOuter, roadLeft, roadRight, rightOuter];

        const startCuts = StraightRoadPrimitive.getExtremityValues(this.cuts?.startCut, length);
        const endCuts = StraightRoadPrimitive.getExtremityValues(this.cuts?.endCut, length);
        const repeat = endV - startV;

        const startX = lateral.map((_, index) => -halfLength + startCuts[index]);
        const endX = lateral.map((_, index) => halfLength - endCuts[index]);

        const rightSegments = StraightRoadPrimitive.getSideCutSegments({
            cuts: this.cuts?.rightCuts,
            length,
            overlapStartX: Math.max(startX[2], startX[3]),
            overlapEndX: Math.min(endX[2], endX[3]),
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
            { x: startX[2], z: roadRight },
            { x: startX[3], z: rightOuter },
        ];
        const endEdge: IPoint2D[] = [
            { x: endX[3], z: rightOuter },
            { x: endX[2], z: roadRight },
            { x: endX[1], z: roadLeft },
            { x: endX[0], z: leftOuter },
        ];

        for (const point of startEdge) {
            StraightRoadPrimitive.pushUniquePoint(outline, point);
        }

        let rightBoundaryX = startX[3];
        for (const cut of rightSegments) {
            if (cut.from > rightBoundaryX) {
                StraightRoadPrimitive.pushUniquePoint(outline, { x: cut.from, z: rightOuter });
            }
            StraightRoadPrimitive.pushUniquePoint(outline, { x: cut.roadFrom, z: roadRight });
            StraightRoadPrimitive.pushUniquePoint(outline, { x: cut.roadTo, z: roadRight });
            StraightRoadPrimitive.pushUniquePoint(outline, { x: cut.to, z: rightOuter });
            rightBoundaryX = cut.to;
        }
        StraightRoadPrimitive.pushUniquePoint(outline, { x: endX[3], z: rightOuter });

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
            vertices.push(point.x, point.y, 0);
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
        const dx = this.endPos.x - this.startPos.x;
        const dz = this.endPos.z - this.startPos.z;
        const length = Math.hypot(dx, dz);
        if (length <= 0) return null;

        const bands = getBands(this.roadType);
        const widthM = bands.totalWidthM;
        if (widthM <= 0) return null;

        const startV = textureProgressV;
        const endV = startV + length / lineLength;
        const hasCustomCuts = Boolean(this.cuts?.startCut || this.cuts?.endCut || this.cuts?.rightCuts?.length || this.cuts?.leftCuts?.length);
        if (!hasCustomCuts) {
            const geometry = new THREE.PlaneGeometry(length, widthM);
            const uvArray = [0, startV, 0, endV, 1, startV, 1, endV];
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvArray, 2));
            return geometry;
        }

        return this.createCutGeometry({
            length,
            widthM,
            carriagewayStartM: bands.carriagewayStartM,
            carriagewayEndM: bands.carriagewayEndM,
            startV,
            endV,
        });
    }


    protected override createMesh(): THREE.Mesh | null {
        const textureProgressV = 0, lineLength = RoadConstants.yellowLineLength, offsetM = 0;
        const geometry = this.createGeometry({ textureProgressV, lineLength });
        if (!geometry) return null;

        const dx = this.endPos.x - this.startPos.x;
        const dz = this.endPos.z - this.startPos.z;
        const angle = Math.atan2(-dz, dx);

        const bands = getBands(this.roadType);
        const widthM = bands.totalWidthM;
        const carriagewayCenter = (bands.carriagewayStartM + bands.carriagewayEndM) / 2;
        const halfOffsetM = carriagewayCenter - widthM / 2;
        const normalX = Math.sin(angle);
        const normalZ = Math.cos(angle);
        const centerX = (this.startPos.x + this.endPos.x) / 2;
        const centerZ = (this.startPos.z + this.endPos.z) / 2;
        const material = RoadTextureBuilder.getRoadMaterial(this.roadType);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            centerX + normalX * (halfOffsetM + offsetM),
            this.startPos.y ?? 0,
            centerZ + normalZ * (halfOffsetM + offsetM)
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = angle;
        return mesh;
    }
}
