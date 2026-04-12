// import * as THREE from 'three';
// import { BandPainter } from './BandPainter';
// import { type IJunctionGeometry, type IJunctionTextureOptions } from './RoadLayout';
// import type { IRoad, IRoadOptions } from './roads/IRoad';
// import { IOrientation2D } from '../sim/IPoint';
// import { RoadBuilder } from './RoadBuilder';

// export interface IJunctionSection {
//     type: 'road-in' | 'road-out' | 'walkway' | 'grass';
//     widthM: number;
//     angle: number;
//     roadOptions?: IRoadOptions;
// }

// interface IPreparedJunctionSection {
//     section: IJunctionSection;
//     widthM: number;
//     dx?: number;
//     dz?: number;
// }

// interface IPreparedJunction {
//     sections: IPreparedJunctionSection[];
//     textureWidthM: number;
//     textureHeightM: number;
//     centerX: number;
//     centerY: number;
// }

// class JunctionSectionLayoutBuilder {
//     static readonly WALKWAY_WIDTH_M = 3.0;
//     static readonly GRASS_WIDTH_M = 3.0;
//     static readonly ROAD_FALLBACK_WIDTH_M = 7.0;
//     static readonly LAYOUT_PADDING_M = 1.0;

//     static build(sections: IJunctionSection[]): IPreparedJunction {
//         const preparedSections = sections
//             .map((section) => this.prepare(section))
//             .filter((entry) => entry !== undefined);

//         const longestLengthM = preparedSections.reduce((max, entry) => Math.max(max, entry.section.widthM), 0);
//         const widestSectionM = preparedSections.reduce((max, entry) => Math.max(max, entry.widthM), 0);
//         const halfSizeM = Math.max(1, longestLengthM + widestSectionM / 2 + this.LAYOUT_PADDING_M);
//         const textureWidthM = halfSizeM * 2;
//         const textureHeightM = halfSizeM * 2;

//         return {
//             sections: preparedSections,
//             textureWidthM,
//             textureHeightM,
//             centerX: textureWidthM / 2,
//             centerY: textureHeightM / 2,
//         };
//     }

//     private static prepare(section: IJunctionSection): IPreparedJunctionSection | undefined {
//         let widthM: number;
//         widthM = section.widthM ?? 0.5;
//         return {
//             section,
//             widthM,
//         };
//     }


// }

// export class JunctionBuilder {

//     static materialByStyle = new Map<string, THREE.MeshStandardMaterial>();
//     static sectionMaterialByStyle = new Map<string, THREE.MeshStandardMaterial>();
//     private static readonly ZEBRA_BAND_WIDTH_M = 3.0;
//     private static readonly ZEBRA_MARGIN_M = 0.4;
//     private static readonly ZEBRA_STRIPE_SIZE_M = 0.5;
//     private static readonly ZEBRA_STRIPE_GAP_M = 0.5;

//     constructor(readonly scene: THREE.Object3D) {
//     }

//     // static createGeometry(mainRoad: IRoad, crossingRoad: IRoad, options?: IJunctionTextureOptions): IJunctionGeometry {
//     //     return buildCrossJunctionGeometry(mainRoad, crossingRoad, options);
//     // }

//     // static getMaterial(mainRoad: IRoad, crossingRoad: IRoad, options?: IJunctionTextureOptions): THREE.MeshStandardMaterial {
//     //     const key = JSON.stringify({ mainRoad, crossingRoad, options });
//     //     const existing = this.materialByStyle.get(key);
//     //     if (existing) {
//     //         return existing;
//     //     }

//     //     const material = new THREE.MeshStandardMaterial({
//     //         map: this.createTexture(mainRoad, crossingRoad, options),
//     //         side: THREE.DoubleSide,
//     //         transparent: true,
//     //     });
//     //     this.materialByStyle.set(key, material);
//     //     return material;
//     // }

//     //static createTexture(mainRoad: IRoad, crossingRoad: IRoad, options?: IJunctionTextureOptions): THREE.DataTexture {
//     // const geometry = this.createGeometry(mainRoad, crossingRoad, options);
//     // const ppm = Math.max(1, RoadBuilder.TEXTURE_PPM);
//     // const widthPx = Math.max(1, Math.round(geometry.textureWidthM * ppm));
//     // const heightPx = Math.max(1, Math.round(geometry.textureHeightM * ppm));
//     // const canvas = document.createElement('canvas');
//     // canvas.width = widthPx;
//     // canvas.height = heightPx;

//     // const ctx = canvas.getContext('2d');
//     // if (!ctx) {
//     //     throw new Error('Unable to create 2D context for junction texture');
//     // }

//     // ctx.clearRect(0, 0, widthPx, heightPx);

//     // const intersectionLeftPx = Math.round((geometry.textureWidthM / 2 - geometry.intersectionWidthM / 2) * ppm);
//     // const intersectionTopPx = Math.round((geometry.textureHeightM / 2 - geometry.intersectionHeightM / 2) * ppm);
//     // const intersectionWidthPx = Math.max(1, Math.round(geometry.intersectionWidthM * ppm));
//     // const intersectionHeightPx = Math.max(1, Math.round(geometry.intersectionHeightM * ppm));

//     // // If either incoming road style is "new", center asphalt uses new color.
//     // const centerRoadColor = this.isNewRoad(mainRoad) || this.isNewRoad(crossingRoad)
//     //     ? RoadBuilder.NEW_ROAD_COLOR
//     //     : RoadBuilder.OLD_ROAD_COLOR;
//     // const painter = new BandPainter(ctx);
//     // painter.rect(centerRoadColor, intersectionLeftPx, intersectionTopPx, intersectionWidthPx, intersectionHeightPx);

//     // this.drawHorizontalArm(painter, geometry, mainRoad, ppm, intersectionLeftPx, intersectionWidthPx);
//     // this.drawVerticalArm(painter, geometry, crossingRoad, ppm, intersectionTopPx, intersectionHeightPx);
//     // this.drawCrosswalks(ctx, geometry, options);
//     // this.drawCenterMarking(ctx, geometry, options);

//     // const imageData = ctx.getImageData(0, 0, widthPx, heightPx);
//     // const texture = new THREE.DataTexture(
//     //     new Uint8Array(imageData.data),
//     //     widthPx,
//     //     heightPx,
//     //     THREE.RGBAFormat,
//     // );
//     // texture.needsUpdate = true;
//     // texture.wrapS = THREE.ClampToEdgeWrapping;
//     // texture.wrapT = THREE.ClampToEdgeWrapping;
//     // return texture;
//     //}

//     // addCrossJunction(position: IOrientation2D, mainRoad: IRoad, crossingRoad: IRoad, options?: IJunctionTextureOptions): THREE.Mesh {
//     //     const geometry = JunctionBuilder.createGeometry(mainRoad, crossingRoad, options);
//     //     const mesh = new THREE.Mesh(
//     //         new THREE.PlaneGeometry(geometry.textureWidthM, geometry.textureHeightM),
//     //         JunctionBuilder.getMaterial(mainRoad, crossingRoad, options),
//     //     );
//     //     mesh.position.set(position.x, position.y ?? 0, position.z);
//     //     mesh.rotation.x = -Math.PI / 2;
//     //     mesh.rotation.z = position.angle;
//     //     this.scene.add(mesh);
//     //     return mesh;
//     // }



//     addCrossJunction2(position: IOrientation2D, roads: IJunctionSection[], options?: IJunctionTextureOptions): THREE.Mesh {
//         const layout = JunctionSectionLayoutBuilder.build(roads);
//         const material = JunctionBuilder.getMaterialFromSections(layout, options);
//         const mesh = new THREE.Mesh(
//             new THREE.PlaneGeometry(layout.textureWidthM, layout.textureHeightM),
//             material,
//         );
//         mesh.position.set(position.x, position.y ?? 0, position.z);
//         mesh.rotation.x = -Math.PI / 2;
//         mesh.rotation.z = position.angle;
//         this.scene.add(mesh);
//         return mesh;
//     }

//     private static getMaterialFromSections(layout: IPreparedJunction, options?: IJunctionTextureOptions): THREE.MeshStandardMaterial {
//         const key = JSON.stringify({
//             sections: layout.sections.map((entry) => ({
//                 type: entry.section.type,
//                 angle: entry.section.angle,
//                 lengthM: entry.section.widthM,
//                 widthM: entry.widthM,
//                 //roadOptions: entry.section.roadOptions,
//             })),
//             options: options ?? {},
//         });
//         const existing = this.sectionMaterialByStyle.get(key);
//         if (existing) {
//             return existing;
//         }

//         const texture = this.createTextureFromSections(layout, options);
//         const material = new THREE.MeshStandardMaterial({
//             map: texture,
//             side: THREE.DoubleSide,
//             transparent: true,
//         });
//         this.sectionMaterialByStyle.set(key, material);
//         return material;
//     }

//     private static createTextureFromSections(layout: IPreparedJunction, options?: IJunctionTextureOptions): THREE.DataTexture {
//         const ppm = Math.max(1, RoadBuilder.TEXTURE_PPM);
//         const widthPx = Math.max(1, Math.round(layout.textureWidthM * ppm));
//         const heightPx = Math.max(1, Math.round(layout.textureHeightM * ppm));
//         const canvas = document.createElement('canvas');
//         canvas.width = widthPx;
//         canvas.height = heightPx;

//         const ctx = canvas.getContext('2d');
//         if (!ctx) {
//             throw new Error('Unable to create 2D context for section junction texture');
//         }

//         ctx.clearRect(0, 0, widthPx, heightPx);

//         const centerXPx = Math.round(layout.centerX * ppm);
//         const centerYPx = Math.round(layout.centerY * ppm);
//         const roadSections = layout.sections.filter((entry) => entry.section.type === 'road-in' || entry.section.type === 'road-out');

//         // for (const entry of layout.sections) {
//         //     const sectionColor = this.getSectionColor(entry.section);
//         //     const sectionLengthPx = this.metersToPixels(entry.section.widthM, ppm, 1);
//         //     const sectionWidthPx = this.metersToPixels(entry.widthM, ppm, 1);

//         //     ctx.save();
//         //     ctx.translate(centerXPx, centerYPx);
//         //     ctx.rotate(entry.section.angle);
//         //     ctx.fillStyle = sectionColor;
//         //     ctx.fillRect(0, -Math.round(sectionWidthPx / 2), sectionLengthPx, sectionWidthPx);

//         //     ctx.restore();
//         // }

//         this.drawSimpleCenterPolygon(ctx, roadSections, centerXPx, centerYPx, ppm);

//         // if ((options?.crosswalks ?? 'none') === 'zebra') {
//         //     for (const entry of roadSections) {
//         //         if (entry.section.type !== 'road-in') continue;

//         //         const sectionLengthPx = this.metersToPixels(entry.section.widthM, ppm, 1);
//         //         const sectionWidthPx = this.metersToPixels(entry.widthM, ppm, 1);

//         //         ctx.save();
//         //         ctx.translate(centerXPx, centerYPx);
//         //         ctx.rotate(entry.section.angle);
//         //         this.drawSectionCrosswalk(ctx, sectionLengthPx, sectionWidthPx, ppm);
//         //         ctx.restore();
//         //     }
//         // }

//         if ((options?.centerMarking ?? 'none') === 'box') {
//             this.drawCenterPolygonMarking(ctx, roadSections, centerXPx, centerYPx, ppm);
//         }

//         const imageData = ctx.getImageData(0, 0, widthPx, heightPx);
//         const texture = new THREE.DataTexture(
//             new Uint8Array(imageData.data),
//             widthPx,
//             heightPx,
//             THREE.RGBAFormat,
//         );
//         texture.needsUpdate = true;
//         texture.wrapS = THREE.ClampToEdgeWrapping;
//         texture.wrapT = THREE.ClampToEdgeWrapping;
//         return texture;
//     }

//     private static drawSimpleCenterPolygon(
//         ctx: CanvasRenderingContext2D,
//         roadSections: IPreparedJunctionSection[],
//         centerXPx: number,
//         centerYPx: number,
//         ppm: number,
//     ): void {
//         const hull = this.getPolygon(roadSections, centerXPx, centerYPx, ppm);
//         if (hull.length < 3) return;

//         //const hasNewRoad = roadSections.some((entry) => entry.section.roadOptions?.roadColor === 'new');
//         //ctx.fillStyle = hasNewRoad ? RoadBuilder.NEW_ROAD_COLOR : RoadBuilder.OLD_ROAD_COLOR;
//         ctx.beginPath();
//         ctx.moveTo(hull[0].x, hull[0].y);
//         for (let i = 1; i < hull.length; i++) {
//             ctx.lineTo(hull[i].x, hull[i].y);
//         }
//         ctx.closePath();
//         ctx.fill();
//     }

//     private static drawCenterPolygonMarking(
//         ctx: CanvasRenderingContext2D,
//         roadSections: IPreparedJunctionSection[],
//         centerXPx: number,
//         centerYPx: number,
//         ppm: number,
//     ): void {
//         const hull = this.getPolygon(roadSections, centerXPx, centerYPx, ppm);
//         if (hull.length < 3) return;

//         ctx.strokeStyle = RoadBuilder.YELLOW_LINE;
//         ctx.lineWidth = this.metersToPixels(0.15, ppm, 1);
//         ctx.beginPath();
//         ctx.moveTo(hull[0].x, hull[0].y);
//         for (let i = 1; i < hull.length; i++) {
//             ctx.lineTo(hull[i].x, hull[i].y);
//         }
//         ctx.closePath();
//         ctx.stroke();
//     }

//     private static getPolygon(
//         roadSections: IPreparedJunctionSection[],
//         centerXPx: number,
//         centerYPx: number,
//         ppm: number,
//     ): { x: number; y: number }[] {
//         if (roadSections.length < 2) return [];
//         let x = centerXPx, y = centerYPx;

//         const points: { x: number; y: number }[] = [];
//         for (const entry of roadSections) {
//             const halfWidthPx = this.metersToPixels(entry.widthM, ppm, 1) / 2;
//             const cos = Math.cos(entry.section.angle);
//             const sin = Math.sin(entry.section.angle);

//             const x1 = x;
//             const y1 = y;
//             const x2 = x + sin * halfWidthPx;
//             const y2 = y - cos * halfWidthPx;
//             console.log(`Section ${entry.section.type} at angle ${entry.section.angle} adds points (${x1.toFixed(1)}, ${y1.toFixed(1)}) and (${x2.toFixed(1)}, ${y2.toFixed(1)})`);
//             points.push({ x: x1, y: y1 }, { x: x2, y: y2 });
//             x = x2;
//             y = y2;
//         }

//         return points;
//     }



//     private static drawHorizontalArm(
//         _painter: BandPainter,
//         _geometry: IJunctionGeometry,
//         _road: IRoad,
//         _ppm: number,
//         _intersectionLeftPx: number,
//         _intersectionWidthPx: number,
//     ): void {
//         // const arm = geometry.arms[0].crossSection;
//         // const asphaltColor = this.isNewRoad(road) ? RoadBuilder.NEW_ROAD_COLOR : RoadBuilder.OLD_ROAD_COLOR;
//         // const totalWidthPx = Math.max(1, Math.round(geometry.textureWidthM * ppm));
//         // const centerYPx = Math.round((geometry.textureHeightM * ppm) / 2);
//         // let currentYPx = Math.round(centerYPx - (arm.totalWidthM * ppm) / 2);

//         // for (const band of arm.bands) {
//         //     const bandHeightPx = Math.max(1, Math.round(band.widthM * ppm));
//         //     const extendsThroughCenter = band.type === 'oldRoad' || band.type === 'newRoad';
//         //     painter.bandH(band, asphaltColor, 0, extendsThroughCenter ? totalWidthPx : intersectionLeftPx, currentYPx, bandHeightPx);
//         //     painter.bandH(band, asphaltColor, extendsThroughCenter ? 0 : intersectionLeftPx + intersectionWidthPx, totalWidthPx, currentYPx, bandHeightPx);
//         //     currentYPx += bandHeightPx;
//         // }
//     }

//     private static drawVerticalArm(
//         _painter: BandPainter,
//         _geometry: IJunctionGeometry,
//         _road: IRoad,
//         _ppm: number,
//         _intersectionTopPx: number,
//         _intersectionHeightPx: number,
//     ): void {
//         // const arm = geometry.arms[1].crossSection;
//         // const asphaltColor = this.isNewRoad(road) ? RoadBuilder.NEW_ROAD_COLOR : RoadBuilder.OLD_ROAD_COLOR;
//         // const totalHeightPx = Math.max(1, Math.round(geometry.textureHeightM * ppm));
//         // const centerXPx = Math.round((geometry.textureWidthM * ppm) / 2);
//         // let currentXPx = Math.round(centerXPx - (arm.totalWidthM * ppm) / 2);

//         // for (const band of arm.bands) {
//         //     const bandWidthPx = Math.max(1, Math.round(band.widthM * ppm));
//         //     const extendsThroughCenter = band.type === 'oldRoad' || band.type === 'newRoad';
//         //     painter.bandV(band, asphaltColor, currentXPx, bandWidthPx, 0, extendsThroughCenter ? totalHeightPx : intersectionTopPx);
//         //     painter.bandV(band, asphaltColor, currentXPx, bandWidthPx, extendsThroughCenter ? 0 : intersectionTopPx + intersectionHeightPx, totalHeightPx);
//         //     currentXPx += bandWidthPx;
//         // }
//     }

//     private static drawCenterMarking(
//         ctx: CanvasRenderingContext2D,
//         geometry: IJunctionGeometry,
//         options?: IJunctionTextureOptions,
//     ): void {
//         if ((options?.centerMarking ?? 'none') !== 'box') {
//             return;
//         }

//         const ppm = Math.max(1, RoadBuilder.TEXTURE_PPM);
//         const insetPx = Math.max(3, Math.round(ppm * 0.75));
//         const strokePx = Math.max(2, Math.round(ppm * 0.15));
//         const leftPx = Math.round((geometry.textureWidthM / 2 - geometry.intersectionWidthM / 2) * ppm) + insetPx;
//         const topPx = Math.round((geometry.textureHeightM / 2 - geometry.intersectionHeightM / 2) * ppm) + insetPx;
//         const widthPx = Math.max(1, Math.round(geometry.intersectionWidthM * ppm) - insetPx * 2);
//         const heightPx = Math.max(1, Math.round(geometry.intersectionHeightM * ppm) - insetPx * 2);

//         ctx.strokeStyle = RoadBuilder.YELLOW_LINE;
//         ctx.lineWidth = strokePx;
//         ctx.strokeRect(leftPx, topPx, widthPx, heightPx);
//     }

//     private static drawCrosswalks(
//         ctx: CanvasRenderingContext2D,
//         geometry: IJunctionGeometry,
//         options?: IJunctionTextureOptions,
//     ): void {
//         if ((options?.crosswalks ?? 'none') !== 'zebra') {
//             return;
//         }

//         const ppm = Math.max(1, RoadBuilder.TEXTURE_PPM);
//         const centerLeftPx = Math.round((geometry.textureWidthM / 2 - geometry.intersectionWidthM / 2) * ppm);
//         const centerTopPx = Math.round((geometry.textureHeightM / 2 - geometry.intersectionHeightM / 2) * ppm);
//         const centerWidthPx = Math.max(1, Math.round(geometry.intersectionWidthM * ppm));
//         const centerHeightPx = Math.max(1, Math.round(geometry.intersectionHeightM * ppm));

//         const crosswalkBandPx = this.metersToPixels(this.ZEBRA_BAND_WIDTH_M, ppm, 4);
//         const marginPx = this.metersToPixels(this.ZEBRA_MARGIN_M, ppm, 2);
//         const stripeSizePx = this.metersToPixels(this.ZEBRA_STRIPE_SIZE_M, ppm, 3);
//         const stripeGapPx = this.metersToPixels(this.ZEBRA_STRIPE_GAP_M, ppm, 2);

//         ctx.fillStyle = RoadBuilder.WHITE_LINE;

//         this.drawHorizontalZebra(
//             ctx,
//             centerLeftPx + marginPx,
//             centerTopPx - crosswalkBandPx,
//             Math.max(1, centerWidthPx - marginPx * 2),
//             crosswalkBandPx,
//             stripeSizePx,
//             stripeGapPx,
//         );

//         this.drawHorizontalZebra(
//             ctx,
//             centerLeftPx + marginPx,
//             centerTopPx + centerHeightPx,
//             Math.max(1, centerWidthPx - marginPx * 2),
//             crosswalkBandPx,
//             stripeSizePx,
//             stripeGapPx,
//         );

//         this.drawVerticalZebra(
//             ctx,
//             centerLeftPx - crosswalkBandPx,
//             centerTopPx + marginPx,
//             crosswalkBandPx,
//             Math.max(1, centerHeightPx - marginPx * 2),
//             stripeSizePx,
//             stripeGapPx,
//         );

//         this.drawVerticalZebra(
//             ctx,
//             centerLeftPx + centerWidthPx,
//             centerTopPx + marginPx,
//             crosswalkBandPx,
//             Math.max(1, centerHeightPx - marginPx * 2),
//             stripeSizePx,
//             stripeGapPx,
//         );
//     }

//     private static drawHorizontalZebra(
//         ctx: CanvasRenderingContext2D,
//         x: number,
//         y: number,
//         width: number,
//         height: number,
//         stripeWidth: number,
//         stripeGap: number,
//     ): void {
//         const step = Math.max(1, stripeWidth + stripeGap);
//         for (let stripeX = x; stripeX < x + width; stripeX += step) {
//             const rectWidth = Math.min(stripeWidth, x + width - stripeX);
//             if (rectWidth > 0) {
//                 ctx.fillRect(stripeX, y, rectWidth, height);
//             }
//         }
//     }

//     private static drawVerticalZebra(
//         ctx: CanvasRenderingContext2D,
//         x: number,
//         y: number,
//         width: number,
//         height: number,
//         stripeHeight: number,
//         stripeGap: number,
//     ): void {
//         const step = Math.max(1, stripeHeight + stripeGap);
//         for (let stripeY = y; stripeY < y + height; stripeY += step) {
//             const rectHeight = Math.min(stripeHeight, y + height - stripeY);
//             if (rectHeight > 0) {
//                 ctx.fillRect(x, stripeY, width, rectHeight);
//             }
//         }
//     }

//     private static metersToPixels(meters: number, ppm: number, minPx = 1): number {
//         return Math.max(minPx, Math.round(meters * ppm));
//     }

//     private static isNewRoad(road: IRoad): boolean {
//         return road.forward.roadColor === 'new' || road.backward?.roadColor === 'new';
//     }
// }
