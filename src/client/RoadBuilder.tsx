import * as THREE from "three";
import { BandPainter } from "./BandPainter";
import { getBands } from "./RoadLayout";
import type { IRoadType } from "./roads/IRoad";
import type { IOrientation2D, IPoint2D } from "../sim/IPoint";
import { Lane } from "./IRoadBand";

export interface ISideCuts {
    from: number; // sidewalk start cut
    roadFrom: number;
    roadTo: number;
    to: number; // sidewalk end cut
}

export interface IExtremityCut {
    left: number;
    roadLeft: number;
    roadRight: number;
    right: number;
}

export interface IRoadCuts {
    rightCuts?: ISideCuts[];
    leftCuts?: ISideCuts[];
    startCut?: IExtremityCut;
    endCut?: IExtremityCut;
}

export class RoadBuilder {
    textureProgressV: number = 0;

    static materialByStyle = new Map<string, THREE.MeshStandardMaterial>();

    static LINE_LENGTH = 8; // every 8 metres, which is a common length for dashed lines and also works well for solid lines.
    static OLD_ROAD_COLOR = 'hsl(0, 2%, 7%)';
    static NEW_ROAD_COLOR = 'hsl(0, 2%, 3.5%)';
    static TEXTURE_PPM = 10; // 1 pixel = 0.1m = 10 cm
    static SIDEWALK_COLOR = 'hsl(230, 3%, 40.0%)';
    static GRASS_COLOR = 'hsl(120, 40%, 40%)';
    static YELLOW_LINE = 'hsl(66, 38.70%, 46.70%)';
    static WHITE_LINE = 'hsl(66, 10.0%, 86.70%)';
    static NARROW_LANE_WIDTH_M = 3.0;
    static NORMAL_LANE_WIDTH_M = 3.5;
    static WIDE_LANE_WIDTH_M = 4.25;
    static TRANSPARENT = 'transparent';

    static GRASS_WIDTH_M = 1; // metre
    static YELLOW_LINE_WIDTH_M = 0.15; // 15 cm
    static PAVEMENT_WIDTH_M = 1.5; // metre
    static TEXTURE_HEIGHT_M = 8; // This allow us to make 4m discontinous yellow line

    static DEFAULT_SHOULDER_WIDTH_M = 0.5; // 50 cm
    static EMERGENCY_LANE_WIDTH_M = 2; // metre
    static PARALLEL_PARKING_WIDTH_M = 2.4; // metre
    static PERPENDICULAR_PARKING_WIDTH_M = 5.0; // metre
    static SMALL_SIDEWALK_M = 1; // metre
    static LARGE_SIDEWALK_M = 2; // metre

    static TURNING_SEGMENTS_MULTIPLIER = 12;
    static currentX: number;


    static metersToPixels(meters: number): number {
        return meters * this.TEXTURE_PPM;
    }

    static getLaneWidthMeters(laneWidth: 'narrow' | 'normal' | 'wide'): number {
        switch (laneWidth) {
            case 'narrow': return this.NARROW_LANE_WIDTH_M;
            case 'wide': return this.WIDE_LANE_WIDTH_M;
            default: return this.NORMAL_LANE_WIDTH_M;
        }
    }

    static getEntryExitWidthMeters(laneWidth: Lane): number {
        return this.getLaneWidthMeters(laneWidth) + this.YELLOW_LINE_WIDTH_M;
    }

    static getKerbWidthMeters(kerb: IRoadType['rightKerb'], _laneWidth: Lane): number {
        switch (kerb) {
            case 'parallelParking': return this.PARALLEL_PARKING_WIDTH_M;
            case 'perpendicularParking': return this.PERPENDICULAR_PARKING_WIDTH_M;
            case 'emergencyLane': return this.YELLOW_LINE_WIDTH_M + this.EMERGENCY_LANE_WIDTH_M;
            case 'line': return this.YELLOW_LINE_WIDTH_M + this.YELLOW_LINE_WIDTH_M;
            default: return 0;
        }
    }

    static getSidewalkWidthMeters(sidewalk: IRoadType['rightSidewalk']): number {
        switch (sidewalk) {
            case 'small':
            case 'large': return this.LARGE_SIDEWALK_M;
            default: return 0;
        }
    }

    private constructor() { }

    static styleKey(options: IRoadType): string {
        return [
            options.roadColor,
            options.lanes,
            options.rightSidewalk,
            options.rightKerb,
            options.laneWidth,
            options.leftKerb,
            options.leftSidewalk
        ].join('|');
    }

    static createStraightRoadMesh(params: {
        halfOffsetM: number;
        widthM: number;
        uvArray: number[];
        length: number;
        center: IOrientation2D;
        normal: IPoint2D;
        roadType: IRoadType;
        scene: THREE.Object3D;
    }): void {
        const { halfOffsetM, widthM, uvArray, length, center, normal, roadType: options, scene } = params;
        if (widthM <= 0) return;
        const roadGeometry = new THREE.PlaneGeometry(length, widthM);
        const road = new THREE.Mesh(roadGeometry, this.getRoadMaterial(options));
        road.position.set(
            center.x + normal.x * halfOffsetM,
            center.y ?? 0,
            center.z + normal.z * halfOffsetM
        );
        road.rotation.x = -Math.PI / 2;
        road.rotation.z = center.angle;
        roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvArray.slice(), 2));
        scene.add(road);
    }

    private static clampExtremityValue(value: number, length: number): number {
        if (!Number.isFinite(value)) return 0;
        return THREE.MathUtils.clamp(value, 0, length);
    }

    private static getExtremityValues(cut: IExtremityCut | undefined, length: number): [number, number, number, number] {
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
        cuts: ISideCuts[] | undefined;
        length: number;
        overlapStartX: number;
        overlapEndX: number;
    }): ISideCuts[] {
        const { cuts, length, overlapStartX, overlapEndX } = params;
        if (!cuts?.length || overlapEndX <= overlapStartX) return [];

        const toLocalX = (value: number): number => -length / 2 + this.clampExtremityValue(value, length);
        const normalizedCuts = [...cuts].sort((left, right) => left.from - right.from);
        const segments: ISideCuts[] = [];
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

    private static createStraightCutGeometry(params: {
        length: number;
        widthM: number;
        carriagewayStartM: number;
        carriagewayEndM: number;
        startV: number;
        endV: number;
        rightCuts?: ISideCuts[];
        leftCuts?: ISideCuts[];
        startCut?: IExtremityCut;
        endCut?: IExtremityCut;
    }): THREE.BufferGeometry {
        const {
            length,
            widthM,
            carriagewayStartM,
            carriagewayEndM,
            startV,
            endV,
            rightCuts,
            leftCuts,
            startCut,
            endCut,
        } = params;
        const halfLength = length / 2;
        const leftOuter = widthM / 2;
        const roadLeft = leftOuter - carriagewayStartM;
        const roadRight = leftOuter - carriagewayEndM;
        const rightOuter = -widthM / 2;
        const lateral = [leftOuter, roadLeft, roadRight, rightOuter];

        const startCuts = this.getExtremityValues(startCut, length);
        const endCuts = this.getExtremityValues(endCut, length);
        const repeat = endV - startV;

        const startX = lateral.map((_, index) => -halfLength + startCuts[index]);
        const endX = lateral.map((_, index) => halfLength - endCuts[index]);

        const rightSegments = this.getSideCutSegments({
            cuts: rightCuts,
            length,
            overlapStartX: Math.max(startX[2], startX[3]),
            overlapEndX: Math.min(endX[2], endX[3]),
        });
        const leftSegments = this.getSideCutSegments({
            cuts: leftCuts,
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
            this.pushUniquePoint(outline, point);
        }

        let rightBoundaryX = startX[3];
        for (const cut of rightSegments) {
            if (cut.from > rightBoundaryX) {
                this.pushUniquePoint(outline, { x: cut.from, z: rightOuter });
            }
            this.pushUniquePoint(outline, { x: cut.roadFrom, z: roadRight });
            this.pushUniquePoint(outline, { x: cut.roadTo, z: roadRight });
            this.pushUniquePoint(outline, { x: cut.to, z: rightOuter });
            rightBoundaryX = cut.to;
        }
        this.pushUniquePoint(outline, { x: endX[3], z: rightOuter });

        for (const point of endEdge) {
            this.pushUniquePoint(outline, point);
        }

        let leftBoundaryX = endX[0];
        for (let index = leftSegments.length - 1; index >= 0; index--) {
            const cut = leftSegments[index];
            if (cut.to < leftBoundaryX) {
                this.pushUniquePoint(outline, { x: cut.to, z: leftOuter });
            }
            this.pushUniquePoint(outline, { x: cut.roadTo, z: roadLeft });
            this.pushUniquePoint(outline, { x: cut.roadFrom, z: roadLeft });
            this.pushUniquePoint(outline, { x: cut.from, z: leftOuter });
            leftBoundaryX = cut.from;
        }
        this.pushUniquePoint(outline, { x: startX[0], z: leftOuter });

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
            const baseU = THREE.MathUtils.clamp((leftOuter - point.y) / widthM, 0, 1);
            const u = baseU;
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

    static createStraightRoad(params: {
        start: IOrientation2D;
        scene: THREE.Object3D;
        length: number;
        style: IRoadType;
        textureProgressV?: number;
        cuts?: IRoadCuts;
        offsetM?: number;
    }): void {
        const { start, scene, length, style: options, textureProgressV = 0, cuts, offsetM = 0 } = params;

        const y = start.y ?? 0;

        if (length <= 0) return;

        const bands = getBands(options);
        const widthM = bands.totalWidthM;
        // Origin is now at the center of the carriageway, not the left edge
        const carriagewayCenter = (bands.carriagewayStartM + bands.carriagewayEndM) / 2;
        const halfOffsetM = carriagewayCenter - widthM / 2;
        const dx = Math.cos(start.angle) * length;
        const dz = -Math.sin(start.angle) * length;
        const normalX = Math.sin(start.angle);
        const normalZ = Math.cos(start.angle);
        const repeat = length / RoadBuilder.LINE_LENGTH;
        const startV = textureProgressV;
        const endV = startV + repeat;
        const uvArray = [0, startV, 0, endV, 1, startV, 1, endV];

        const centerX = start.x + dx / 2;
        const centerZ = start.z + dz / 2;
        const sharedParams = {
            length,
            center: { x: centerX, y, z: centerZ, angle: start.angle },
            normal: { x: normalX, z: normalZ },
            scene,
        };

        const hasCustomCuts = Boolean(cuts?.startCut || cuts?.endCut || cuts?.rightCuts?.length || cuts?.leftCuts?.length);
        if (!hasCustomCuts) {
            RoadBuilder.createStraightRoadMesh({
                ...sharedParams,
                halfOffsetM: halfOffsetM + offsetM,
                widthM,
                uvArray,
                roadType: options,
            });
            return;
        }

        const geometry = this.createStraightCutGeometry({
            length,
            widthM,
            carriagewayStartM: bands.carriagewayStartM,
            carriagewayEndM: bands.carriagewayEndM,
            startV,
            endV,
            rightCuts: cuts?.rightCuts,
            leftCuts: cuts?.leftCuts,
            startCut: cuts?.startCut,
            endCut: cuts?.endCut,
        });
        const mesh = new THREE.Mesh(geometry, this.getRoadMaterial(options));
        mesh.position.set(
            centerX + normalX * (halfOffsetM + offsetM),
            y,
            centerZ + normalZ * (halfOffsetM + offsetM)
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = start.angle;
        scene.add(mesh);
    }

    static createArcRoad(params: {
        start: IOrientation2D;
        radius: number;
        sweepAngle: number;
        scene: THREE.Object3D;
        roadType: IRoadType;
        cuts?: IRoadCuts;
        textureProgressV?: number;
        segments?: number;
        segmentLength?: number;
    }): void {
        const {
            start,
            radius,
            sweepAngle,
            scene,
            roadType: options,
            cuts: _cuts,
            textureProgressV = 0,
            segments,
            segmentLength = 2,
        } = params;

        const safeRadius = Math.max(0.001, Math.abs(radius));
        const safeSweepAngle = Number.isFinite(sweepAngle) ? sweepAngle : 0;
        if (Math.abs(safeSweepAngle) < 1e-6) return;
        const minSegmentLength = Math.max(0.1, segmentLength);

        const bands = getBands(options);
        const widthM = bands.totalWidthM;
        if (widthM <= 0) return;

        // Keep requested sweep (so handles/endpoints stay correct) and full nominal width.
        // If the turn is too tight, clamp only the inner boundary radius.
        const halfWidth = widthM / 2;
        const minInnerRadius = 0.2;
        const innerRadius = Math.max(minInnerRadius, safeRadius - halfWidth);
        const outerRadius = safeRadius + halfWidth;

        const leftNormalX = Math.sin(start.angle);
        const leftNormalZ = Math.cos(start.angle);
        // Convention: sweepAngle < 0 turns left, sweepAngle > 0 turns right.
        const turnDirection = safeSweepAngle < 0 ? -1 : 1;
        // leftNormal = (sin θ, cos θ) = the RIGHT perpendicular of the road.
        // For a left turn, arc center is to the LEFT = -leftNormal; turnDirection=-1 → + leftNormal * (-1)
        // For a right turn, arc center is to the RIGHT = +leftNormal; turnDirection=+1 → + leftNormal * (+1)
        const center = {
            x: start.x + leftNormalX * safeRadius * turnDirection,
            z: start.z + leftNormalZ * safeRadius * turnDirection,
        };

        const curveSweepAngle = -safeSweepAngle;
        const arcLength = safeRadius * Math.abs(curveSweepAngle);
        const subdivisionCount = Math.max(2, segments ?? Math.ceil(arcLength / minSegmentLength));

        const vertices: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        for (let i = 0; i <= subdivisionCount; i++) {
            const t = i / subdivisionCount;
            const tangentAngle = start.angle + curveSweepAngle * t;
            const leftN = { x: Math.sin(tangentAngle), z: Math.cos(tangentAngle) };

            // For right turn (turnDirection>0), left boundary is inner.
            // For left turn (turnDirection<0), right boundary is inner.
            const leftRadius = turnDirection > 0 ? innerRadius : outerRadius;
            const rightRadius = turnDirection > 0 ? outerRadius : innerRadius;
            const radialSign = -turnDirection;
            const leftBoundary = {
                x: center.x + leftN.x * radialSign * leftRadius,
                z: center.z + leftN.z * radialSign * leftRadius,
            };
            const rightBoundary = {
                x: center.x + leftN.x * radialSign * rightRadius,
                z: center.z + leftN.z * radialSign * rightRadius,
            };

            const v = textureProgressV + (arcLength / this.LINE_LENGTH) * t;
            vertices.push(leftBoundary.x, start.y ?? 0, leftBoundary.z);
            uvs.push(1, v);
            vertices.push(rightBoundary.x, start.y ?? 0, rightBoundary.z);
            uvs.push(0, v);
        }

        for (let i = 0; i < subdivisionCount; i++) {
            const a = i * 2;
            const b = a + 1;
            const c = a + 2;
            const d = a + 3;
            indices.push(a, c, b);
            indices.push(c, d, b);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, this.getRoadMaterial(options));
        scene.add(mesh);
    }

    // static createCurvedRoadMesh(params: {
    //     side: 'left' | 'right';
    //     options: IRoadOptions;
    //     bands: IRoadBands;
    //     gap: number;
    //     turnAngle: number;
    //     segments: number;
    //     radius: number;
    //     totalCurveAngle: number;
    //     startV: number;
    //     arcCenter: IPoint3D;
    //     initialRoadAngle: number;
    //     geomAngleOffset: number;
    //     scene: THREE.Object3D;
    // }): void {
    //     const { side, options, bands, gap, turnAngle, segments, radius, totalCurveAngle, startV, arcCenter, initialRoadAngle, geomAngleOffset, scene } = params;
    //     const widthM = bands.totalWidthM;
    //     if (widthM <= 0) return;
    //     const halfGapM = gap / 2;
    //     const turnSideSign = turnAngle >= 0 ? 1 : -1;
    //     const innerOffset = (side === 'right' ? halfGapM : -halfGapM) * turnSideSign;
    //     const outerOffset = side === 'right'
    //         ? (halfGapM + widthM) * turnSideSign
    //         : -(halfGapM + widthM) * turnSideSign;

    //     const getCurvePoint = (t: number, offsetRadius: number) => {
    //         const currentTangentAngle = initialRoadAngle + t * turnAngle;
    //         const geometryRayAngle = currentTangentAngle + geomAngleOffset;
    //         const cosRay = Math.cos(geometryRayAngle);
    //         const sinRay = Math.sin(geometryRayAngle);
    //         return {
    //             x: arcCenter.x + cosRay * (radius + offsetRadius),
    //             z: arcCenter.z - sinRay * (radius + offsetRadius),
    //         };
    //     };

    //     const vertices: number[] = [];
    //     const uvsSide: number[] = [];
    //     for (let i = 0; i <= segments; i++) {
    //         const t = i / segments;
    //         const innerPoint = getCurvePoint(t, innerOffset);
    //         const outerPoint = getCurvePoint(t, outerOffset);
    //         vertices.push(innerPoint.x, arcCenter.y, innerPoint.z);
    //         vertices.push(outerPoint.x, arcCenter.y, outerPoint.z);
    //         const v = (radius * totalCurveAngle * t) / RoadBuilder.LINE_LENGTH;
    //         const vv = startV + v;
    //         uvsSide.push(0, vv);
    //         uvsSide.push(1, vv);
    //     }

    //     const geometry = new THREE.BufferGeometry();
    //     geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    //     geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvsSide, 2));

    //     const indices: number[] = [];
    //     for (let i = 0; i < segments; i++) {
    //         const a = i * 2;
    //         const b = a + 1;
    //         const c = a + 2;
    //         const d = a + 3;
    //         indices.push(a, b, d);
    //         indices.push(a, d, c);
    //     }
    //     geometry.setIndex(indices);
    //     geometry.computeVertexNormals();

    //     const mesh = new THREE.Mesh(geometry, this.getRoadMaterial(options));
    //     scene.add(mesh);
    // }

    static getRoadMaterial(options: IRoadType): THREE.MeshStandardMaterial {
        const key = this.styleKey(options);
        const existing = this.materialByStyle.get(key);
        if (existing) {
            return existing;
        }

        const texture = this.createRoadTexture(options);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
        });
        this.materialByStyle.set(key, material);
        // material.wireframe = true;
        return material;
    }

    static createRoadTexture(options: IRoadType) {

        const canvas = document.createElement('canvas');
        const layout = getBands(options);
        const textureWidthPx = this.metersToPixels(layout.totalWidthM);
        const textureHeightPx = this.metersToPixels(this.TEXTURE_HEIGHT_M);
        canvas.width = textureWidthPx;
        canvas.height = textureHeightPx;
        const ctx = canvas.getContext('2d')!;
        const painter = new BandPainter(ctx, options);


        painter.drawBands(layout.bands);

        const imageData = ctx.getImageData(0, 0, textureWidthPx, textureHeightPx);
        const data = new Uint8Array(imageData.data);

        const texture = new THREE.DataTexture(
            data,
            textureWidthPx,
            textureHeightPx,
            THREE.RGBAFormat
        );
        texture.needsUpdate = true;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        RoadBuilder.showTextureInBody(canvas);
        return texture;
    }

    static texY = 20;

    static showTextureInBody(canvas: HTMLCanvasElement) {
        const imageDataURL = canvas.toDataURL('image/png');
        const imgElement = document.createElement('img');

        // Définir ses attributs et styles
        imgElement.src = imageDataURL;
        imgElement.style.position = 'fixed';
        imgElement.style.top = this.texY + 'px'; // Ou une autre position
        this.texY += (canvas.height + 10); // Décale la prochaine image pour éviter le chevauchement
        imgElement.style.left = (80 + (document.querySelectorAll('img[id^="debugCanvasImage"]').length * (canvas.width + 10))) + 'px'; // Décale les images
        imgElement.style.zIndex = '200'; // Pour s'assurer qu'elle est au-dessus

        // Ajouter l'élément image au body (ou à un conteneur spécifique si vous préférez)
        document.body.appendChild(imgElement);

        //document.body.innerHTML += `<img style="position:fixed; top:20px; left:80px;" src="${imageDataURL}" >`;

    }


}
