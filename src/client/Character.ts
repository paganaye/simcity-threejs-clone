import * as THREE from "three";

type RGB = [number, number, number];
type FaceName = "front" | "back" | "left" | "right" | "top" | "bottom";

export class Character {
  private walkShader?: { uniforms: Record<string, { value: unknown }> };

  createMaterial(): THREE.MeshPhongMaterial {
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      emissive: 0x111111,
    });
    this.setupWalkAnimationShader(material);
    return material;
  }

  updateAnimation(elapsed: number): void {
    if (!this.walkShader) {
      return;
    }
    const uTime = this.walkShader.uniforms["uTime"];
    if (uTime) {
      uTime.value = elapsed;
    }
  }

  createGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const parts: number[] = [];
    const pivots: number[] = [];

    const skin: RGB = [1.0, 0.72, 0.78];
    const hair: RGB = [0.36, 0.23, 0.13];
    const torso: RGB = [0.20, 0.52, 0.95];
    const arms: RGB = [0.15, 0.78, 0.46];
    const legs: RGB = [0.26, 0.28, 0.33];

    const PART_BODY = 0;
    const PART_LEFT_ARM = 1;
    const PART_RIGHT_ARM = 2;
    const PART_LEFT_LEG = 3;
    const PART_RIGHT_LEG = 4;

    const addCube = (
      width: number,
      height: number,
      depth: number,
      x: number,
      y: number,
      z: number,
      defaultColor: RGB,
      faceTriangleColors?: Partial<Record<FaceName, [RGB, RGB]>>,
      partId: number = PART_BODY,
      pivot: [number, number, number] = [x, y, z]
    ) => {
      const w = width / 2;
      const h = height / 2;
      const d = depth / 2;

      const v = [
        [x - w, y - h, z + d],
        [x + w, y - h, z + d],
        [x + w, y + h, z + d],
        [x - w, y + h, z + d],
        [x - w, y - h, z - d],
        [x + w, y - h, z - d],
        [x + w, y + h, z - d],
        [x - w, y + h, z - d],
      ];

      const faces = [
        { name: "front" as FaceName, vertices: [0, 1, 2, 0, 2, 3], normal: [0, 0, 1] as RGB },
        { name: "back" as FaceName, vertices: [5, 4, 7, 5, 7, 6], normal: [0, 0, -1] as RGB },
        { name: "left" as FaceName, vertices: [4, 3, 7, 4, 0, 3], normal: [-1, 0, 0] as RGB },
        { name: "right" as FaceName, vertices: [5, 6, 2, 1, 5, 2], normal: [1, 0, 0] as RGB },
        { name: "top" as FaceName, vertices: [3, 2, 6, 3, 6, 7], normal: [0, 1, 0] as RGB },
        { name: "bottom" as FaceName, vertices: [4, 5, 1, 4, 1, 0], normal: [0, -1, 0] as RGB },
      ];

      faces.forEach(({ name, vertices: faceIndices, normal }) => {
        const triColors = faceTriangleColors?.[name] ?? [defaultColor, defaultColor];

        for (let tri = 0; tri < 2; tri++) {
          const triColor = triColors[tri];
          for (let corner = 0; corner < 3; corner++) {
            const idx = faceIndices[tri * 3 + corner];
            positions.push(...v[idx]);
            normals.push(...normal);
            colors.push(...triColor);
            parts.push(partId);
            pivots.push(pivot[0], pivot[1], pivot[2]);
          }
        }
      });
    };

    addCube(0.4, 0.4, 0.4, 0, 1.6, 0, skin, {
      top: [hair, hair],
      back: [hair, hair],
      left: [hair, skin],
      right: [hair, skin],
      front: [skin, skin],
      bottom: [skin, skin],
    }, PART_BODY);

    addCube(0.4, 0.6, 0.4, 0, 0.9, 0, torso, undefined, PART_BODY);
    addCube(0.15, 0.6, 0.15, -0.35, 1.0, 0, arms, undefined, PART_LEFT_ARM, [-0.35, 1.28, 0]);
    addCube(0.15, 0.6, 0.15, 0.35, 1.0, 0, arms, undefined, PART_RIGHT_ARM, [0.35, 1.28, 0]);
    addCube(0.15, 0.6, 0.15, -0.15, 0.3, 0, legs, undefined, PART_LEFT_LEG, [-0.15, 0.6, 0]);
    addCube(0.15, 0.6, 0.15, 0.15, 0.3, 0, legs, undefined, PART_RIGHT_LEG, [0.15, 0.6, 0]);

    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
    geometry.setAttribute("aPart", new THREE.BufferAttribute(new Float32Array(parts), 1));
    geometry.setAttribute("aPivot", new THREE.BufferAttribute(new Float32Array(pivots), 3));

    return geometry;
  }

  private setupWalkAnimationShader(material: THREE.MeshPhongMaterial): void {
    material.onBeforeCompile = (shader) => {
      this.walkShader = shader;
      shader.uniforms.uTime = { value: 0 };

      shader.vertexShader = `
attribute float aPart;
attribute vec3 aPivot;
attribute float aWalk;
attribute float aPhase;
uniform float uTime;
` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
vec3 transformed = vec3(position);

if (aWalk > 0.5 && aPart > 0.5) {
  float gait = sin(uTime * 8.0 + aPhase);
  float angle = 0.0;

  if (aPart < 1.5) {
    angle = -gait * 0.40;
  } else if (aPart < 2.5) {
    angle = gait * 0.40;
  } else if (aPart < 3.5) {
    angle = gait * 0.70;
  } else if (aPart < 4.5) {
    angle = -gait * 0.70;
  }

  float c = cos(angle);
  float s = sin(angle);
  vec3 p = transformed - aPivot;
  vec3 rotated = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  transformed = rotated + aPivot;
}
`
      );
    };

    material.needsUpdate = true;
  }
}
