import type { IDualRoadType} from './IRoad';
import { RoadType } from './RoadType';



export interface IJunctionArm {
    road: IDualRoadType;
    angleRad: number;
    crossSection: RoadType;
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





