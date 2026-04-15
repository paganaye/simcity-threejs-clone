import * as THREE from "three";
import { render } from "solid-js/web";
import { GameScene3D } from "../GameScene3D";
import { GameUIComponent } from "../GameUIComponent";
import { Page } from "../Page";
import type { IRoadType } from "../roads/IRoad";
import { RoadConstants, roadBands, type KerbType, type SideWalkType } from "../textures/RoadBand";

export interface IShaderRoad {
  forward: IRoadType;
}

interface SeparatorStyle {
  width: number;
  lineWidth: number;
  lineMode: number; // 0 dashed, 1 solid, 2 none
}

function roadColorToRgb(roadColor: IRoadType["roadColor"]): readonly [number, number, number] {
  const color = roadColor === "new" ? RoadConstants.NEW_ROAD_COLOR : RoadConstants.OLD_ROAD_COLOR;
  const parsed = new THREE.Color(color);
  return [parsed.r, parsed.g, parsed.b];
}

function encodeWalkwayType(sidewalk: SideWalkType): number {
  switch (sidewalk) {
    case "small": return 1;
    case "large": return 2;
    case "grass": return 3;
    default: return 0;
  }
}

function getSeparatorStyle(type: KerbType): SeparatorStyle {
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

export default class RoadShaderTest extends Page {
  scene3DInstance: GameScene3D | undefined;
  private mesh?: THREE.Mesh;

  async run() {
    const mapSize = { x: 48, z: 48 };
    const scene3D = new GameScene3D(mapSize);
    this.scene3DInstance = scene3D;

    const road: IShaderRoad = {
      forward: {
        roadColor: "old",
        lanes: 3,
        laneWidth: "normal",
        leftSidewalk: "small",
        leftKerb: "line",
        rightKerb: "line",
        rightSidewalk: "grass",
      },
    };

    const leftKerb = getSeparatorStyle(road.forward.leftKerb);
    const rightKerb = getSeparatorStyle(road.forward.rightKerb);

    const uniforms = {
      uRoadColor: { value: new THREE.Vector3(...roadColorToRgb(road.forward.roadColor)) },
      uLaneMarkingColor: { value: new THREE.Color(RoadConstants.whiteLine) },
      uLaneMarkingWidth: { value: RoadConstants.YELLOW_LINE_WIDTH_M },
      uLaneMarkingDashPeriod: { value: RoadConstants.yellowLineLength },
      uLaneMarkingDashDuty: { value: 0.5 },
      uKerbColor: { value: new THREE.Color(RoadConstants.yellowLine) },
      uSidewalkColor: { value: new THREE.Color(RoadConstants.walkWay) },
      uGrassColor: { value: new THREE.Color(RoadConstants.grass) },
      uWalkwaySmallWidth: { value: roadBands.small.widthM },
      uWalkwayLargeWidth: { value: roadBands.large.widthM },
      uWalkwayGrassWidth: { value: roadBands.grass.widthM },
      uLaneCount: { value: road.forward.lanes },
      uLaneWidth: { value: roadBands[road.forward.laneWidth].widthM },
      uLeftKerbLineMode: { value: leftKerb.lineMode },
      uRightKerbLineMode: { value: rightKerb.lineMode },
      uLeftKerbWidth: { value: leftKerb.width },
      uLeftKerbLineWidth: { value: leftKerb.lineWidth },
      uRightKerbWidth: { value: rightKerb.width },
      uRightKerbLineWidth: { value: rightKerb.lineWidth },
      uLeftWalkwayType: { value: encodeWalkwayType(road.forward.leftSidewalk) },
      uRightWalkwayType: { value: encodeWalkwayType(road.forward.rightSidewalk) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;

        uniform vec3 uRoadColor;
        uniform vec3 uLaneMarkingColor;
        uniform float uLaneMarkingWidth;
        uniform float uLaneMarkingDashPeriod;
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

        bool isDashedLine(float y, float period, float duty) {
          float f = fract(y / period);
          return f < duty;
        }

        bool separatorDrawLine(float lineMode, float yMeters) {
          if (lineMode < 0.5) {
            return isDashedLine(yMeters, uLaneMarkingDashPeriod, uLaneMarkingDashDuty);
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
          float yMeters = vUv.y * 90.0;

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

          if (inSeparatorLine(xMeters, leftKerbStart, kerbL, uLeftKerbLineWidth) && separatorDrawLine(uLeftKerbLineMode, yMeters)) {
            color = uKerbColor;
          }
          if (inSeparatorLine(xMeters, rightKerbStart, kerbR, uRightKerbLineWidth) && separatorDrawLine(uRightKerbLineMode, yMeters)) {
            color = uKerbColor;
          }

          if (xMeters > roadStart && xMeters < roadEnd) {
            for (int i = 1; i < 8; i++) {
              float laneX = roadStart + float(i) * uLaneWidth;
              if (float(i) >= uLaneCount) break;
              if (abs(xMeters - laneX) <= 0.5 * uLaneMarkingWidth && isDashedLine(yMeters, uLaneMarkingDashPeriod, uLaneMarkingDashDuty)) {
                color = uLaneMarkingColor;
              }
            }
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    const handleUILoaded = async (): Promise<void> => {
      await scene3D.init(this);

      const geom = new THREE.PlaneGeometry(48, 96, 1, 1);
      this.mesh = new THREE.Mesh(geom, material);
      this.mesh.rotation.x = -Math.PI * 0.5;
      this.scene.add(this.mesh);

      scene3D.isLoading.set(false);
      this.setCameraView(24, 34, 40, 0, 0, 0);
    };

    render(() => (
      <GameUIComponent
        page={this}
        scene3D={scene3D}
        mapSize={mapSize}
        onUILoaded={handleUILoaded}
      />
    ), this.appContainer);
  }

  override loop(elapsed: number): void {
    this.scene3DInstance?.drawFrame(elapsed);
  }

  override cleanup(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (Array.isArray(this.mesh.material)) {
        for (const material of this.mesh.material) material.dispose();
      } else {
        this.mesh.material.dispose();
      }
      this.mesh = undefined;
    }


    this.scene3DInstance = undefined;
    super.cleanup();
  }
}
