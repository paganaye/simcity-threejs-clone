import * as THREE from "three";
import { BandPainter } from "./BandPainter";
import { getBands } from "../roads/RoadLayout";
import type { IRoadType } from "../roads/IRoad";
import { Lane, RoadConstants } from "./RoadBand";
export type { ISideCuts, IExtremityCut, IRoadCuts } from "../roads/RoadCuts";

export class RoadTextureBuilder {
    textureProgressV: number = 0;

    static materialByStyle = new Map<string, THREE.MeshStandardMaterial>();



    static metersToPixels(meters: number): number {
        return meters * RoadConstants.TEXTURE_PPM;
    }

    static getLaneWidthMeters(laneWidth: 'narrow' | 'normal' | 'wide'): number {
        switch (laneWidth) {
            case 'narrow': return RoadConstants.NARROW_LANE_WIDTH_M;
            case 'wide': return RoadConstants.WIDE_LANE_WIDTH_M;
            default: return RoadConstants.NORMAL_LANE_WIDTH_M;
        }
    }

    static getEntryExitWidthMeters(laneWidth: Lane): number {
        return this.getLaneWidthMeters(laneWidth) + RoadConstants.YELLOW_LINE_WIDTH_M;
    }

    static getKerbWidthMeters(kerb: IRoadType['rightKerb'], _laneWidth: Lane): number {
        switch (kerb) {
            case 'parallelParking': return RoadConstants.PARALLEL_PARKING_WIDTH_M;
            case 'perpendicularParking': return RoadConstants.PERPENDICULAR_PARKING_WIDTH_M;
            case 'emergencyLane': return RoadConstants.YELLOW_LINE_WIDTH_M + RoadConstants.EMERGENCY_LANE_WIDTH_M;
            case 'line': return RoadConstants.YELLOW_LINE_WIDTH_M + RoadConstants.YELLOW_LINE_WIDTH_M;
            default: return 0;
        }
    }

    static getSidewalkWidthMeters(sidewalk: IRoadType['rightSidewalk']): number {
        switch (sidewalk) {
            case 'small':
            case 'large': return RoadConstants.LARGE_SIDEWALK_M;
            default: return 0;
        }
    }

    private constructor() { }

    static styleKey(roadType: IRoadType): string {
        return [
            roadType.roadColor,
            roadType.lanes,
            roadType.rightSidewalk,
            roadType.rightKerb,
            roadType.laneWidth,
            roadType.leftKerb,
            roadType.leftSidewalk
        ].join('|');
    }

    static getRoadMaterial(roadType: IRoadType): THREE.MeshStandardMaterial {
        const key = this.styleKey(roadType);
        const existing = this.materialByStyle.get(key);
        if (existing) {
            return existing;
        }

        const texture = this.createRoadTexture(roadType);
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
        const textureHeightPx = this.metersToPixels(RoadConstants.TEXTURE_HEIGHT_M);
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

        RoadTextureBuilder.showTextureInBody(canvas);
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
