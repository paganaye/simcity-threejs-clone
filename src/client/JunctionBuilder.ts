import * as THREE from 'three';
import { BandPainter } from './BandPainter';
import { buildCrossJunctionGeometry, type IJunctionGeometry, type IJunctionTextureOptions } from './RoadLayout';
import { RoadBuilder } from './RoadBuilder';
import type { IRoad } from './roads/IRoad';
import { IOrientation2D } from '../sim/IPoint';

export class JunctionBuilder {

    static materialByStyle = new Map<string, THREE.MeshStandardMaterial>();
    private static readonly ZEBRA_BAND_WIDTH_M = 3.0;
    private static readonly ZEBRA_MARGIN_M = 0.4;
    private static readonly ZEBRA_STRIPE_SIZE_M = 0.5;
    private static readonly ZEBRA_STRIPE_GAP_M = 0.5;

    constructor(readonly scene: THREE.Object3D) {
    }

    static createGeometry(mainRoad: IRoad, crossingRoad: IRoad, options?: IJunctionTextureOptions): IJunctionGeometry {
        return buildCrossJunctionGeometry(mainRoad, crossingRoad, RoadBuilder.getLayoutMetrics(), options);
    }

    static getMaterial(mainRoad: IRoad, crossingRoad: IRoad, options?: IJunctionTextureOptions): THREE.MeshStandardMaterial {
        const key = JSON.stringify({ mainRoad, crossingRoad, options });
        const existing = this.materialByStyle.get(key);
        if (existing) {
            return existing;
        }

        const material = new THREE.MeshStandardMaterial({
            map: this.createTexture(mainRoad, crossingRoad, options),
            side: THREE.DoubleSide,
            transparent: true,
        });
        this.materialByStyle.set(key, material);
        return material;
    }

    static createTexture(mainRoad: IRoad, crossingRoad: IRoad, options?: IJunctionTextureOptions): THREE.DataTexture {
        const geometry = this.createGeometry(mainRoad, crossingRoad, options);
        const ppm = Math.max(1, RoadBuilder.TEXTURE_PPM);
        const widthPx = Math.max(1, Math.round(geometry.textureWidthM * ppm));
        const heightPx = Math.max(1, Math.round(geometry.textureHeightM * ppm));
        const canvas = document.createElement('canvas');
        canvas.width = widthPx;
        canvas.height = heightPx;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Unable to create 2D context for junction texture');
        }

        ctx.clearRect(0, 0, widthPx, heightPx);

        const intersectionLeftPx = Math.round((geometry.textureWidthM / 2 - geometry.intersectionWidthM / 2) * ppm);
        const intersectionTopPx = Math.round((geometry.textureHeightM / 2 - geometry.intersectionHeightM / 2) * ppm);
        const intersectionWidthPx = Math.max(1, Math.round(geometry.intersectionWidthM * ppm));
        const intersectionHeightPx = Math.max(1, Math.round(geometry.intersectionHeightM * ppm));

        // If either incoming road style is "new", center asphalt uses new color.
        const centerRoadColor = this.isNewRoad(mainRoad) || this.isNewRoad(crossingRoad)
            ? RoadBuilder.NEW_ROAD_COLOR
            : RoadBuilder.OLD_ROAD_COLOR;
        const painter = new BandPainter(ctx);
        painter.rect(centerRoadColor, intersectionLeftPx, intersectionTopPx, intersectionWidthPx, intersectionHeightPx);

        this.drawHorizontalArm(painter, geometry, mainRoad, ppm, intersectionLeftPx, intersectionWidthPx);
        this.drawVerticalArm(painter, geometry, crossingRoad, ppm, intersectionTopPx, intersectionHeightPx);
        this.drawCrosswalks(ctx, geometry, options);
        this.drawCenterMarking(ctx, geometry, options);

        const imageData = ctx.getImageData(0, 0, widthPx, heightPx);
        const texture = new THREE.DataTexture(
            new Uint8Array(imageData.data),
            widthPx,
            heightPx,
            THREE.RGBAFormat,
        );
        texture.needsUpdate = true;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        return texture;
    }

    addCrossJunction(position: IOrientation2D, mainRoad: IRoad, crossingRoad: IRoad, options?: IJunctionTextureOptions): THREE.Mesh {
        const geometry = JunctionBuilder.createGeometry(mainRoad, crossingRoad, options);
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(geometry.textureWidthM, geometry.textureHeightM),
            JunctionBuilder.getMaterial(mainRoad, crossingRoad, options),
        );
        mesh.position.set(position.x, position.y ?? 0, position.z);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = position.angle;
        this.scene.add(mesh);
        return mesh;
    }

    private static drawHorizontalArm(
        painter: BandPainter,
        geometry: IJunctionGeometry,
        road: IRoad,
        ppm: number,
        intersectionLeftPx: number,
        intersectionWidthPx: number,
    ): void {
        const arm = geometry.arms[0].crossSection;
        const asphaltColor = this.isNewRoad(road) ? RoadBuilder.NEW_ROAD_COLOR : RoadBuilder.OLD_ROAD_COLOR;
        const totalWidthPx = Math.max(1, Math.round(geometry.textureWidthM * ppm));
        const centerYPx = Math.round((geometry.textureHeightM * ppm) / 2);
        let currentYPx = Math.round(centerYPx - (arm.totalWidthM * ppm) / 2);

        for (const band of arm.bands) {
            const bandHeightPx = Math.max(1, Math.round(band.widthM * ppm));
            const extendsThroughCenter = band.kind === 'asphalt';
            painter.bandH(band, asphaltColor, 0, extendsThroughCenter ? totalWidthPx : intersectionLeftPx, currentYPx, bandHeightPx);
            painter.bandH(band, asphaltColor, extendsThroughCenter ? 0 : intersectionLeftPx + intersectionWidthPx, totalWidthPx, currentYPx, bandHeightPx);
            currentYPx += bandHeightPx;
        }
    }

    private static drawVerticalArm(
        painter: BandPainter,
        geometry: IJunctionGeometry,
        road: IRoad,
        ppm: number,
        intersectionTopPx: number,
        intersectionHeightPx: number,
    ): void {
        const arm = geometry.arms[1].crossSection;
        const asphaltColor = this.isNewRoad(road) ? RoadBuilder.NEW_ROAD_COLOR : RoadBuilder.OLD_ROAD_COLOR;
        const totalHeightPx = Math.max(1, Math.round(geometry.textureHeightM * ppm));
        const centerXPx = Math.round((geometry.textureWidthM * ppm) / 2);
        let currentXPx = Math.round(centerXPx - (arm.totalWidthM * ppm) / 2);

        for (const band of arm.bands) {
            const bandWidthPx = Math.max(1, Math.round(band.widthM * ppm));
            const extendsThroughCenter = band.kind === 'asphalt';
            painter.bandV(band, asphaltColor, currentXPx, bandWidthPx, 0, extendsThroughCenter ? totalHeightPx : intersectionTopPx);
            painter.bandV(band, asphaltColor, currentXPx, bandWidthPx, extendsThroughCenter ? 0 : intersectionTopPx + intersectionHeightPx, totalHeightPx);
            currentXPx += bandWidthPx;
        }
    }

    private static drawCenterMarking(
        ctx: CanvasRenderingContext2D,
        geometry: IJunctionGeometry,
        options?: IJunctionTextureOptions,
    ): void {
        if ((options?.centerMarking ?? 'none') !== 'box') {
            return;
        }

        const ppm = Math.max(1, RoadBuilder.TEXTURE_PPM);
        const insetPx = Math.max(3, Math.round(ppm * 0.75));
        const strokePx = Math.max(2, Math.round(ppm * 0.15));
        const leftPx = Math.round((geometry.textureWidthM / 2 - geometry.intersectionWidthM / 2) * ppm) + insetPx;
        const topPx = Math.round((geometry.textureHeightM / 2 - geometry.intersectionHeightM / 2) * ppm) + insetPx;
        const widthPx = Math.max(1, Math.round(geometry.intersectionWidthM * ppm) - insetPx * 2);
        const heightPx = Math.max(1, Math.round(geometry.intersectionHeightM * ppm) - insetPx * 2);

        ctx.strokeStyle = RoadBuilder.YELLOW_LINE;
        ctx.lineWidth = strokePx;
        ctx.strokeRect(leftPx, topPx, widthPx, heightPx);
    }

    private static drawCrosswalks(
        ctx: CanvasRenderingContext2D,
        geometry: IJunctionGeometry,
        options?: IJunctionTextureOptions,
    ): void {
        if ((options?.crosswalks ?? 'none') !== 'zebra') {
            return;
        }

        const ppm = Math.max(1, RoadBuilder.TEXTURE_PPM);
        const centerLeftPx = Math.round((geometry.textureWidthM / 2 - geometry.intersectionWidthM / 2) * ppm);
        const centerTopPx = Math.round((geometry.textureHeightM / 2 - geometry.intersectionHeightM / 2) * ppm);
        const centerWidthPx = Math.max(1, Math.round(geometry.intersectionWidthM * ppm));
        const centerHeightPx = Math.max(1, Math.round(geometry.intersectionHeightM * ppm));

        const crosswalkBandPx = this.metersToPixels(this.ZEBRA_BAND_WIDTH_M, ppm, 4);
        const marginPx = this.metersToPixels(this.ZEBRA_MARGIN_M, ppm, 2);
        const stripeSizePx = this.metersToPixels(this.ZEBRA_STRIPE_SIZE_M, ppm, 3);
        const stripeGapPx = this.metersToPixels(this.ZEBRA_STRIPE_GAP_M, ppm, 2);

        ctx.fillStyle = RoadBuilder.WHITE_LINE;

        this.drawHorizontalZebra(
            ctx,
            centerLeftPx + marginPx,
            centerTopPx - crosswalkBandPx,
            Math.max(1, centerWidthPx - marginPx * 2),
            crosswalkBandPx,
            stripeSizePx,
            stripeGapPx,
        );

        this.drawHorizontalZebra(
            ctx,
            centerLeftPx + marginPx,
            centerTopPx + centerHeightPx,
            Math.max(1, centerWidthPx - marginPx * 2),
            crosswalkBandPx,
            stripeSizePx,
            stripeGapPx,
        );

        this.drawVerticalZebra(
            ctx,
            centerLeftPx - crosswalkBandPx,
            centerTopPx + marginPx,
            crosswalkBandPx,
            Math.max(1, centerHeightPx - marginPx * 2),
            stripeSizePx,
            stripeGapPx,
        );

        this.drawVerticalZebra(
            ctx,
            centerLeftPx + centerWidthPx,
            centerTopPx + marginPx,
            crosswalkBandPx,
            Math.max(1, centerHeightPx - marginPx * 2),
            stripeSizePx,
            stripeGapPx,
        );
    }

    private static drawHorizontalZebra(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        width: number,
        height: number,
        stripeWidth: number,
        stripeGap: number,
    ): void {
        const step = Math.max(1, stripeWidth + stripeGap);
        for (let stripeX = x; stripeX < x + width; stripeX += step) {
            const rectWidth = Math.min(stripeWidth, x + width - stripeX);
            if (rectWidth > 0) {
                ctx.fillRect(stripeX, y, rectWidth, height);
            }
        }
    }

    private static drawVerticalZebra(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        width: number,
        height: number,
        stripeHeight: number,
        stripeGap: number,
    ): void {
        const step = Math.max(1, stripeHeight + stripeGap);
        for (let stripeY = y; stripeY < y + height; stripeY += step) {
            const rectHeight = Math.min(stripeHeight, y + height - stripeY);
            if (rectHeight > 0) {
                ctx.fillRect(x, stripeY, width, rectHeight);
            }
        }
    }

    private static metersToPixels(meters: number, ppm: number, minPx = 1): number {
        return Math.max(minPx, Math.round(meters * ppm));
    }

    private static isNewRoad(road: IRoad): boolean {
        return road.forward.roadColor === 'new' || road.backward?.roadColor === 'new';
    }
}
