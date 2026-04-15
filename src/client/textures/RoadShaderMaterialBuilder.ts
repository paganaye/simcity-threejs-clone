import * as THREE from "three";
import type { IRoadType } from "../roads/IRoad";
import { RoadConstants, type KerbType, type SideWalkType, roadBands } from "./RoadBand";

interface SeparatorStyle {
    width: number;
    lineWidth: number;
    lineMode: number; // 0 dashed, 1 solid, 2 none
}

export class RoadShaderMaterialBuilder {
    static materialByStyle = new Map<string, THREE.ShaderMaterial>();

    private constructor() { }

    static styleKey(roadType: IRoadType): string {
        return [
            roadType.roadColor,
            roadType.lanes,
            roadType.rightSidewalk,
            roadType.rightKerb,
            roadType.laneWidth,
            roadType.leftKerb,
            roadType.leftSidewalk,
        ].join("|");
    }

    static getRoadMaterial(roadType: IRoadType): THREE.ShaderMaterial {
        const key = this.styleKey(roadType);
        const existing = this.materialByStyle.get(key);
        if (existing) {
            return existing;
        }

        const leftKerb = this.getSeparatorStyle(roadType.leftKerb);
        const rightKerb = this.getSeparatorStyle(roadType.rightKerb);

        const uniforms = THREE.UniformsUtils.merge([
          THREE.UniformsLib.lights,
          {
            uRoadColor: { value: this.roadColorToColor(roadType.roadColor) },
            uLaneMarkingColor: { value: new THREE.Color(RoadConstants.yellowLine) },
            uLaneMarkingWidth: { value: roadBands.discontinuous.widthM * 0.5 },
            uLaneMarkingDashDuty: { value: 0.5 },
            uKerbColor: { value: new THREE.Color(RoadConstants.yellowLine) },
            uSidewalkColor: { value: new THREE.Color(RoadConstants.walkWay) },
            uGrassColor: { value: new THREE.Color(RoadConstants.grass) },
            uWalkwaySmallWidth: { value: roadBands.small.widthM },
            uWalkwayLargeWidth: { value: roadBands.large.widthM },
            uWalkwayGrassWidth: { value: roadBands.grass.widthM },
            // Keep lane width aligned with current RoadLayout implementation (normal lane).
            uLaneCount: { value: roadType.lanes },
            uLaneWidth: { value: roadBands.normal.widthM },
            uLeftKerbLineMode: { value: leftKerb.lineMode },
            uRightKerbLineMode: { value: rightKerb.lineMode },
            uLeftKerbWidth: { value: leftKerb.width },
            uLeftKerbLineWidth: { value: leftKerb.lineWidth },
            uRightKerbWidth: { value: rightKerb.width },
            uRightKerbLineWidth: { value: rightKerb.lineWidth },
            uLeftWalkwayType: { value: this.encodeWalkwayType(roadType.leftSidewalk) },
            uRightWalkwayType: { value: this.encodeWalkwayType(roadType.rightSidewalk) },
          },
        ]);

        const material = new THREE.ShaderMaterial({
            uniforms,
            side: THREE.DoubleSide,
          lights: true,
            vertexShader: /* glsl */ `
                varying vec2 vUv;

                void main() {
                  vUv = uv;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */ `
                varying vec2 vUv;
              uniform vec3 ambientLightColor;

                uniform vec3 uRoadColor;
                uniform vec3 uLaneMarkingColor;
                uniform float uLaneMarkingWidth;
                uniform float uLaneMarkingDashDuty;
                uniform vec3 uKerbColor;
                uniform vec3 uSidewalkColor;
                uniform vec3 uGrassColor;
                uniform float uWalkwaySmallWidth;
                uniform float uWalkwayLargeWidth;
                uniform float uWalkwayGrassWidth;
                uniform float uLaneCount;
                uniform float uLaneWidth;
                uniform float uLeftKerbLineMode;
                uniform float uRightKerbLineMode;
                uniform float uLeftKerbWidth;
                uniform float uLeftKerbLineWidth;
                uniform float uRightKerbWidth;
                uniform float uRightKerbLineWidth;
                uniform float uLeftWalkwayType;
                uniform float uRightWalkwayType;

                float walkwayWidth(float t) {
                  if (t < 0.5) return 0.0;
                  if (t < 1.5) return uWalkwaySmallWidth;
                  if (t < 2.5) return uWalkwayLargeWidth;
                  return uWalkwayGrassWidth;
                }

                vec3 sidewalkColor(float t) {
                  if (t < 0.5) return vec3(0.0);
                  if (t < 2.5) return uSidewalkColor;
                  return uGrassColor;
                }

                bool isDashedLine(float v, float duty) {
                  // Match the legacy texture painter: visible band in the middle half [0.25, 0.75]
                  float f = fract(v);
                  float start = (1.0 - duty) * 0.5;
                  float end = 1.0 - start;
                  return f >= start && f <= end;
                }

                bool separatorDrawLine(float lineMode, float v) {
                  if (lineMode < 0.5) {
                    return isDashedLine(v, uLaneMarkingDashDuty);
                  }
                  if (lineMode < 1.5) {
                    return true;
                  }
                  return false;
                }

                bool inSeparatorLine(float xMeters, float separatorStart, float separatorWidth, float lineWidth) {
                  if (separatorWidth <= 0.0 || lineWidth <= 0.0) return false;
                  float center = separatorStart + 0.5 * separatorWidth;
                  return abs(xMeters - center) <= 0.5 * lineWidth;
                }

                void main() {
                  float vCoord = vUv.y;

                  float walkL = walkwayWidth(uLeftWalkwayType);
                  float kerbL = uLeftKerbWidth;
                  float roadW = uLaneCount * uLaneWidth;
                  float kerbR = uRightKerbWidth;
                  float walkR = walkwayWidth(uRightWalkwayType);
                  float totalWidth = walkL + kerbL + roadW + kerbR + walkR;
                  float xMeters = vUv.x * totalWidth;

                  float roadStart = walkL + kerbL;
                  float roadEnd = roadStart + roadW;

                  float leftKerbStart = walkL;
                  float rightKerbStart = roadEnd;

                  vec3 color = vec3(0.05, 0.07, 0.05);

                  if (xMeters < walkL) {
                    color = sidewalkColor(uLeftWalkwayType);
                  } else if (xMeters < walkL + kerbL) {
                    color = uRoadColor;
                  } else if (xMeters < roadEnd) {
                    color = uRoadColor;
                  } else if (xMeters < roadEnd + kerbR) {
                    color = uRoadColor;
                  } else {
                    color = sidewalkColor(uRightWalkwayType);
                  }

                  if (inSeparatorLine(xMeters, leftKerbStart, kerbL, uLeftKerbLineWidth) && separatorDrawLine(uLeftKerbLineMode, vCoord)) {
                    color = uKerbColor;
                  }
                  if (inSeparatorLine(xMeters, rightKerbStart, kerbR, uRightKerbLineWidth) && separatorDrawLine(uRightKerbLineMode, vCoord)) {
                    color = uKerbColor;
                  }

                  if (xMeters > roadStart && xMeters < roadEnd) {
                    for (int i = 1; i < 8; i++) {
                      float laneX = roadStart + float(i) * uLaneWidth;
                      if (float(i) >= uLaneCount) break;
                      if (abs(xMeters - laneX) <= 0.5 * uLaneMarkingWidth && isDashedLine(vCoord, uLaneMarkingDashDuty)) {
                        color = uLaneMarkingColor;
                      }
                    }
                  }

                  vec3 litColor = color * ambientLightColor;
                  gl_FragColor = vec4(litColor, 1.0);
                }
            `,
        });

        this.materialByStyle.set(key, material);
        return material;
    }

    private static roadColorToColor(roadColor: IRoadType["roadColor"]): THREE.Color {
        return new THREE.Color(roadColor === "new" ? RoadConstants.NEW_ROAD_COLOR : RoadConstants.OLD_ROAD_COLOR);
    }

    private static encodeWalkwayType(sidewalk: SideWalkType): number {
        switch (sidewalk) {
            case "small": return 1;
            case "large": return 2;
            case "grass": return 3;
            default: return 0;
        }
    }

    private static getSeparatorStyle(type: KerbType): SeparatorStyle {
        const width = roadBands[type].widthM;
        switch (type) {
            case "line":
                return { width, lineWidth: RoadConstants.YELLOW_LINE_WIDTH_M, lineMode: 0 };
            case "emergencyLane":
                return { width, lineWidth: RoadConstants.YELLOW_LINE_WIDTH_M, lineMode: 1 };
            default:
                return { width, lineWidth: 0, lineMode: 2 };
        }
    }
}
