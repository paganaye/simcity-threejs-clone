import type { IDualRoadType} from './IRoad';
import { RoadBands } from './RoadBands';



export interface IJunctionArm {
    road: IDualRoadType;
    angleRad: number;
    crossSection: RoadBands;
}

export interface IJunctionGeometry {
    centerX: number;
    centerZ: number;
    arms: [IJunctionArm, IJunctionArm];
    textureWidthM: number;
    textureHeightM: number;
    intersectionWidthM: number;
    intersectionHeightM: number;
    approachLengthM: number;
}

export interface IJunctionTextureOptions {
    approachLengthM?: number;
    centerMarking?: 'none' | 'box';
    crosswalks?: 'none' | 'zebra';
}

export interface IJunctionTextureResult {
    canvas: HTMLCanvasElement;
    widthPx: number;
    heightPx: number;
    widthM: number;
    heightM: number;
}





