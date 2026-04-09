import * as THREE from "three";
import { IOrientation2D } from "../sim/IPoint";
import { BandPainter, type BandType, type IRoadBand } from "./BandPainter";
import { IFloorPos } from "./GameUIComponent";
import { buildRoadCrossSection, IRoadCrossSection, IRoadLayoutMetrics } from "./RoadLayout";
import type { IRoad, IRoadOptions, LaneWidth } from "./roads/IRoad";

interface IRoadBands {
    bands: IRoadBand[];
    widthM: number;
    widthPx: number;
}

interface ISideCuts {
    from: number; // sidewalk start cut
    roadFrom: number;
    roadTo: number; 
    to: number; // sidewalk end cut
}

interface IExtremityCut {
    left: number;
    roadLeft: number;
    roadRight: number;
    right: number;
}

interface IRoadCuts {
    rightCuts?: ISideCuts[];
    leftCuts?: ISideCuts[];
    startCut?: IExtremityCut;
    endCut?: IExtremityCut;
}

export class RoadBuilder implements IOrientation2D {
    x: number;
    y: number;
    z: number;
    angle: number;
    textureProgressV: number = 0;

    static materialByStyle = new Map<string, THREE.MeshStandardMaterial>();

    static LINE_LENGTH = 8; // every 8 metres, which is a common length for dashed lines and also works well for solid lines.
    static OLD_ROAD_COLOR = 'hsl(0, 2%, 7%)';
    static NEW_ROAD_COLOR = 'hsl(0, 2%, 3.5%)';
    static TEXTURE_PPM = 10; // to be refined
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

    static getLayoutMetrics(): IRoadLayoutMetrics {
        return {
            oldRoadColor: this.OLD_ROAD_COLOR,
            newRoadColor: this.NEW_ROAD_COLOR,
            sidewalkColor: this.SIDEWALK_COLOR,
            grassColor: this.GRASS_COLOR,
            yellowLineColor: this.YELLOW_LINE,
            whiteLineColor: this.WHITE_LINE,
            yellowLineWidthM: this.YELLOW_LINE_WIDTH_M,
            emergencyLaneWidthM: this.EMERGENCY_LANE_WIDTH_M,
            parallelParkingWidthM: this.PARALLEL_PARKING_WIDTH_M,
            perpendicularParkingWidthM: this.PERPENDICULAR_PARKING_WIDTH_M,
            smallSidewalkM: this.SMALL_SIDEWALK_M,
            largeSidewalkM: this.LARGE_SIDEWALK_M,
            grassWidthM: this.GRASS_WIDTH_M,
            narrowLaneWidthM: this.NARROW_LANE_WIDTH_M,
            normalLaneWidthM: this.NORMAL_LANE_WIDTH_M,
            wideLaneWidthM: this.WIDE_LANE_WIDTH_M,
        };
    }

    static metersToPixels(meters: number): number {
        return Math.round(meters * this.TEXTURE_PPM);
    }

    static getLaneWidthMeters(laneWidth: 'narrow' | 'normal' | 'wide'): number {
        switch (laneWidth) {
            case 'narrow': return this.NARROW_LANE_WIDTH_M;
            case 'wide': return this.WIDE_LANE_WIDTH_M;
            default: return this.NORMAL_LANE_WIDTH_M;
        }
    }

    static getGapWidthMeters(gapSize: number): number {
        return Math.max(0, gapSize || 0);
    }

    static getEntryExitWidthMeters(laneWidth: LaneWidth): number {
        return this.getLaneWidthMeters(laneWidth) + this.YELLOW_LINE_WIDTH_M;
    }

    static getKerbWidthMeters(kerb: IRoadOptions['rightKerb'], _laneWidth: LaneWidth): number {
        switch (kerb) {
            case 'parallelParking': return this.PARALLEL_PARKING_WIDTH_M;
            case 'perpendicularParking': return this.PERPENDICULAR_PARKING_WIDTH_M;
            case 'emergencyLane': return this.YELLOW_LINE_WIDTH_M + this.EMERGENCY_LANE_WIDTH_M;
            case 'line': return this.YELLOW_LINE_WIDTH_M + this.YELLOW_LINE_WIDTH_M;
            case 'gap': return this.YELLOW_LINE_WIDTH_M;
            default: return 0;
        }
    }

    static getSidewalkWidthMeters(sidewalk: IRoadOptions['rightSidewalk']): number {
        switch (sidewalk) {
            case 'small':
            case 'small-hidden': return this.SMALL_SIDEWALK_M;
            case 'large': return this.LARGE_SIDEWALK_M;
            default: return 0;
        }
    }



    static buildRoadBands(options: IRoadOptions): IRoadBands {
        const crossSection = buildRoadCrossSection(options, this.getLayoutMetrics());
        const bands = this.buildBands(options);
        const widthM = crossSection.totalWidthM;
        const widthPx = Math.max(1, this.metersToPixels(widthM));
        return { bands, widthM, widthPx };
    }

    static buildBands(options: IRoadOptions): IRoadBand[] {
        const crossSection = buildRoadCrossSection(options, this.getLayoutMetrics());
        return this.toRoadBands(crossSection);
    }

    static toRoadBands(crossSection: IRoadCrossSection): IRoadBand[] {
        const bands: IRoadBand[] = [];

        const pushBand = (type: BandType, width: number, color: string) => {
            if (width <= 0) return;
            bands.push({ type, width, color });
        };

        for (const band of crossSection.bands) {
            switch (band.kind) {
                case 'asphalt':
                case 'sidewalk':
                case 'grass':
                case 'gap':
                    pushBand('solid', band.widthM, band.color);
                    break;
                case 'laneDivider':
                    pushBand('laneDivider', band.widthM, band.color);
                    break;
                case 'parallelParking':
                    pushBand('parallelParking', band.widthM, band.color);
                    break;
                case 'perpendicularParking':
                    pushBand('perpendicularParking', band.widthM, band.color);
                    break;
            }
        }

        return bands;
    }

    constructor(startPosition: IOrientation2D, readonly scene: THREE.Object3D) {
        this.x = startPosition.x;
        this.y = startPosition.y ?? 0;
        this.z = startPosition.z;
        this.angle = startPosition.angle;
    }

    static styleKey(options: IRoadOptions): string {
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

    static getRoadMaterial(options: IRoadOptions): THREE.MeshStandardMaterial {
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
        return material;
    }

    static createRoadTexture(options: IRoadOptions) {

        const canvas = document.createElement('canvas');
        const layout = this.buildRoadBands(options);
        const textureWidthPx = layout.widthPx;
        const textureHeightPx = this.metersToPixels(this.TEXTURE_HEIGHT_M);
        canvas.width = textureWidthPx;
        canvas.height = textureHeightPx;
        const ctx = canvas.getContext('2d')!;
        const painter = new BandPainter(ctx);

        painter.rect(this.TRANSPARENT, 0, 0, textureWidthPx, textureHeightPx);

        const roadColor = options.roadColor === 'new' ? RoadBuilder.NEW_ROAD_COLOR : RoadBuilder.OLD_ROAD_COLOR;
        const bands = layout.bands;
        let currentX = 0;

        const yellowLinePx = this.metersToPixels(this.YELLOW_LINE_WIDTH_M);
        for (const band of bands) {
            const widthPx = this.metersToPixels(band.width);
            painter.roadBand(band, currentX, widthPx, textureHeightPx, roadColor, RoadBuilder.WHITE_LINE, yellowLinePx);
            currentX += widthPx;
        }

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
    //     static openTextureInNewWindow(canvas: HTMLCanvasElement) {
    //         const newWindow = window.open('', '_blank');
    //         const imageDataURL = canvas.toDataURL('image/png');

    //         if (newWindow) {
    //             newWindow.document.write(`<img src="${imageDataURL}">`);
    //         } else {
    //             console.error("La fenêtre popup n'a pas pu s'ouvrir. Veuillez vérifier les paramètres de votre navigateur.");
    //         }
    //     }

    //     addSphere(x: number, z: number) {
    //         const geometry = new THREE.SphereGeometry(0.05);
    //         const material = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide });
    //         const sphere = new THREE.Mesh(geometry, material);
    //         sphere.position.set(x, 0, z);
    //         this.scene.add(sphere);
    //     }

    addStraightRoad(length: number, road: IRoad, cuts?: IRoadCuts) {
        let left: IRoadOptions | null;
        let right: IRoadOptions;

        const safeGap = Number.isFinite(road.gapSize) ? road.gapSize : 0;
        right = road.forward;
        left = road.backward ?? null;

        if (length <= 0) return;
        const leftBands = left ? RoadBuilder.buildRoadBands(left) : null;
        const rightBands = RoadBuilder.buildRoadBands(right);

        const rightWidthM = rightBands.widthM;
        const leftWidthM = leftBands ? leftBands.widthM : 0;
        const halfGapM = left ? safeGap / 2 : 0;
        const dx = Math.cos(this.angle) * length;
        const dz = -Math.sin(this.angle) * length;
        const normalX = Math.sin(this.angle);
        const normalZ = Math.cos(this.angle);
        const repeat = length / RoadBuilder.LINE_LENGTH;
        const startV = this.textureProgressV;
        const endV = startV + repeat;
        // const rightShouldStretch = RoadBuilder.hasEntryExitKerb(right);
        // const leftShouldStretch = RoadBuilder.hasEntryExitKerb(left);
        const rightUvArray = [0, startV, 0, endV, 1, startV, 1, endV];
        const leftUvArray = [1, startV, 1, endV, 0, startV, 0, endV];

        const createRoad = (halfOffsetM: number, widthM: number, side: 'left' | 'right', options: IRoadOptions) => {
            if (widthM <= 0) return;
            const roadGeometry = new THREE.PlaneGeometry(length, widthM);
            const road = new THREE.Mesh(roadGeometry, RoadBuilder.getRoadMaterial(options));
            road.position.set(
                this.x + dx / 2 + normalX * halfOffsetM,
                this.y,
                this.z + dz / 2 + normalZ * halfOffsetM
            );
            road.rotation.x = -Math.PI / 2;
            road.rotation.z = this.angle;
            const uvSrc = (side === 'right' ? rightUvArray : leftUvArray).slice();
            roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvSrc, 2));
            this.scene.add(road);
        };

        // Gap is geometric only: place each half-road away from center by halfGapM.
        createRoad(halfGapM + rightWidthM / 2, rightWidthM, 'right', right);
        if (left) createRoad(-(halfGapM + leftWidthM / 2), leftWidthM, 'left', left);

        this.x += dx;
        this.z += dz;
        this.textureProgressV = endV;
    }

    addCurvedRoad(turnAngle: number, radius: number, road: IRoad) {
        const leftBands = road.backward ? RoadBuilder.buildRoadBands(road.backward) : null;
        const rightBands = RoadBuilder.buildRoadBands(road.forward);

        let left: IRoadOptions | null;
        let right: IRoadOptions;
        let gap: number;
        right = road.forward;
        left = road.backward ?? null;
        gap = left && Number.isFinite(road.gapSize) ? road.gapSize : 0;

        if (Math.abs(turnAngle) < 0.001) return;

        const DEBUG_ROAD_ARC = true;

        if (DEBUG_ROAD_ARC) {
            console.log('[RoadBuilder.turn] input', {
                roadType: left ? 'two-way' : 'one-way',
                turnAngle,
                radius,
                x: this.x,
                z: this.z,
                angle: this.angle,
                gap,
            });
        }

        const segments = Math.max(1, Math.round(Math.abs(RoadBuilder.TURNING_SEGMENTS_MULTIPLIER * turnAngle)));
        const initialRoadAngle = this.angle;
        const finalRoadAngle = initialRoadAngle + turnAngle;
        const centerCalcDirection = turnAngle > 0 ? -1 : 1;
        const cx = this.x + Math.sin(initialRoadAngle) * radius * centerCalcDirection;
        const cz = this.z + Math.cos(initialRoadAngle) * radius * centerCalcDirection;
        const geomAngleOffset = turnAngle > 0 ? -Math.PI / 2 : +Math.PI / 2;
        const totalCurveAngle = Math.abs(turnAngle);
        const curveLength = radius * totalCurveAngle;
        const startV = this.textureProgressV;
        const uvs: number[] = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const v = (radius * totalCurveAngle * t) / RoadBuilder.LINE_LENGTH;
            uvs.push(0, startV + v);
            uvs.push(1, startV + v);
        }
        this.textureProgressV = startV + curveLength / RoadBuilder.LINE_LENGTH;

        const getCurvePoint = (t: number, offsetRadius: number): IFloorPos => {
            const currentTangentAngle = initialRoadAngle + t * turnAngle;
            const geometryRayAngle = currentTangentAngle + geomAngleOffset;
            const cosRay = Math.cos(geometryRayAngle);
            const sinRay = Math.sin(geometryRayAngle);
            const x = cx + cosRay * (radius + offsetRadius);
            const z = cz - sinRay * (radius + offsetRadius);
            return { x, z };
        };

        const addHalfRoad = (side: 'left' | 'right', options: IRoadOptions, bands: IRoadBands) => {
            const widthM = bands.widthM;
            if (widthM <= 0) return;
            const halfGapM = gap / 2;
            const vertices: number[] = [];
            const uvsSide: number[] = [];
            const turnSideSign = turnAngle >= 0 ? 1 : -1;
            // Gap is geometric only: inner edge starts at +/-halfGapM from the centerline.
            const innerOffset = (side === 'right' ? halfGapM : -halfGapM) * turnSideSign;
            const outerOffset = side === 'right'
                ? (halfGapM + widthM) * turnSideSign
                : -(halfGapM + widthM) * turnSideSign;

            if (DEBUG_ROAD_ARC) {
                console.log('[RoadBuilder.turn] side', {
                    side,
                    widthM,
                    innerOffset,
                    outerOffset,
                    lanes: options.lanes,
                });
            }

            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const innerPoint = getCurvePoint(t, innerOffset);
                const outerPoint = getCurvePoint(t, outerOffset);

                vertices.push(innerPoint.x, this.y, innerPoint.z);
                vertices.push(outerPoint.x, this.y, outerPoint.z);

                const v = (radius * totalCurveAngle * t) / RoadBuilder.LINE_LENGTH;
                // const stretchV = t;
                // const useStretch = RoadBuilder.hasEntryExitKerb(options);
                const vv = (startV + v);
                uvsSide.push(0, vv);
                uvsSide.push(1, vv);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvsSide, 2));

            const indices: number[] = [];
            for (let i = 0; i < segments; i++) {
                const a = i * 2;
                const b = a + 1;
                const c = a + 2;
                const d = a + 3;
                indices.push(a, b, d);
                indices.push(a, d, c);
            }
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            const mesh = new THREE.Mesh(geometry, RoadBuilder.getRoadMaterial(options));
            this.scene.add(mesh);
        };

        if (left && leftBands) addHalfRoad("left", left, leftBands);
        addHalfRoad("right", right, rightBands);

        this.angle = finalRoadAngle;
        const finalGeometryRayAngle = finalRoadAngle + geomAngleOffset;
        this.x = cx + Math.cos(finalGeometryRayAngle) * radius;
        this.z = cz - Math.sin(finalGeometryRayAngle) * radius;

        if (DEBUG_ROAD_ARC) {
            console.log('[RoadBuilder.turn] output', {
                finalAngle: this.angle,
                finalX: this.x,
                finalZ: this.z,
                centerX: cx,
                centerZ: cz,
                geomAngleOffset,
            });
        }
    }

}
