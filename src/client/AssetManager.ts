import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { appConstants } from '../AppConstants';
import { Scene3D } from './Scene3D';

export interface IAssetMeta {
  type: 'zone' | 'road' | 'vehicle' | 'power' | "terrain",
  filename: string;
  scale?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  rotation?: number;
  updateMaterials?: boolean;
}

//const ZERO_VECTOR = new THREE.Vector3(0, 0, 0);
const HIDE_SCALE = new THREE.Vector3(0, 0, 0);
const IDENTITY_QUATERNION = new THREE.Quaternion();
const HIDE_MATRIX = new THREE.Matrix4().compose(
  new THREE.Vector3(0, -9999, 0),
  IDENTITY_QUATERNION,
  HIDE_SCALE
);

const modelsMetaData = {
  "firstprim": {
    "type": "zone",
    "filename": "firstprim.glb",
    "scale": 15,
    "updateMaterials": false
  },
  "under-construction": {
    "type": "zone",
    "filename": "construction-small.glb",
    "scale": 3
  },
  "residential-A1": {
    "type": "zone",
    "filename": "building-house-block-big.glb"
  },
  "residential-B1": {
    "type": "zone",
    "filename": "building-house-family-small.glb"
  },
  "residential-C1": {
    "type": "zone",
    "filename": "building-house-family-large.glb"
  },
  "residential-A2": {
    "type": "zone",
    "filename": "building-block-4floor-short.glb",
  },
  "residential-B2": {
    "type": "zone",
    "filename": "building-block-4floor-corner.glb",
  },
  "residential-C2": {
    "type": "zone",
    "filename": "building-block-5floor.glb",
  },
  "residential-A3": {
    "type": "zone",
    "filename": "building-office-balcony.glb"
  },
  "residential-B3": {
    "type": "zone",
    "filename": "building-office-pyramid.glb"
  },
  "residential-C3": {
    "type": "zone",
    "filename": "building-office-tall.glb"
  },
  "commercial-A1": {
    "type": "zone",
    "filename": "building-cafe.glb"
  },
  "commercial-B1": {
    "type": "zone",
    "filename": "building-burger-joint.glb"
  },
  "commercial-C1": {
    "type": "zone",
    "filename": "building-restaurant.glb"
  },
  "commercial-A2": {
    "type": "zone",
    "filename": "building-cinema.glb"
  },
  "commercial-B2": {
    "type": "zone",
    "filename": "building-casino.glb"
  },
  "commercial-C2": {
    "type": "zone",
    "filename": "data-center.glb"
  },
  "commercial-A3": {
    "type": "zone",
    "filename": "building-office.glb"
  },
  "commercial-B3": {
    "type": "zone",
    "filename": "building-office-big.glb"
  },
  "commercial-C3": {
    "type": "zone",
    "filename": "building-skyscraper.glb"
  },
  "industrial-A1": {
    "type": "zone",
    "filename": "industry-factory.glb"
  },
  "industrial-B1": {
    "type": "zone",
    "filename": "industry-refinery.glb"
  },
  "industrial-C1": {
    "type": "zone",
    "filename": "industry-warehouse.glb"
  },
  // "industrial-A2": {
  //   "type": "zone",
  //   "filename": "industry-factory.glb"
  // },
  // "industrial-B2": {
  //   "type": "zone",
  //   "filename": "industry-refinery.glb"
  // },
  // "industrial-C2": {
  //   "type": "zone",
  //   "filename": "industry-warehouse.glb"
  // },
  // "industrial-A3": {
  //   "type": "zone",
  //   "filename": "industry-factory.glb"
  // },
  // "industrial-B3": {
  //   "type": "zone",
  //   "filename": "industry-refinery.glb"
  // },
  // "industrial-C3": {
  //   "type": "zone",
  //   "filename": "industry-warehouse.glb"
  // },
  "power-plant": {
    "type": "power",
    "filename": "industry-factory-old.glb"
  },
  "power-line": {
    "type": "power",
    "filename": "power_line_pole_modified.glb"
  },
  "road-straight": {
    "type": "road",
    "filename": "tile-road-straight.glb",
    "castShadow": false
  },
  "road-end": {
    "type": "road",
    "filename": "tile-road-end.glb",
    "castShadow": false
  },
  "road-corner": {
    "type": "road",
    "filename": "tile-road-curve.glb",
    "castShadow": false
  },
  "road-three-way": {
    "type": "road",
    "filename": "tile-road-intersection-t.glb",
    "castShadow": false
  },
  "road-four-way": {
    "type": "road",
    "filename": "tile-road-intersection.glb",
    "castShadow": false
  },
  "grass": {
    "type": "terrain",
    "filename": "tile-plain_grass.glb",
    "castShadow": false
  },
  "car-taxi": {
    "type": "vehicle",
    "filename": "car-taxi.glb",
    "rotation": 90
  },
  "car-police": {
    "type": "vehicle",
    "filename": "car-police.glb",
    "rotation": 90
  },
  "car-passenger": {
    "type": "vehicle",
    "filename": "car-passenger.glb",
    "rotation": 90
  },
  "car-veteran": {
    "type": "vehicle",
    "filename": "car-veteran.glb",
    "rotation": 90
  },
  "truck": {
    "type": "vehicle",
    "filename": "truck.glb",
    "rotation": 90
  },
  "car-hippie-van": {
    "type": "vehicle",
    "filename": "car-hippie-van.glb",
    "rotation": 90
  },
  "car-tow-truck": {
    "type": "vehicle",
    "filename": "car-tow-truck.glb",
    "rotation": 90
  },
  "car-ambulance-pickup": {
    "type": "vehicle",
    "filename": "car-ambulance-pickup.glb",
    "rotation": 90
  },
  "car-passenger-race": {
    "type": "vehicle",
    "filename": "car-passenger-race.glb",
    "rotation": 90
  },
  "car-baywatch": {
    "type": "vehicle",
    "filename": "car-baywatch.glb",
    "rotation": 90
  },
  "car-truck-dump": {
    "type": "vehicle",
    "filename": "car-truck-dump.glb",
    "rotation": 90
  },
  "car-truck-armored-truck": {
    "type": "vehicle",
    "filename": "armored-truck.glb",
    "rotation": 90
  }
} satisfies Record<string, IAssetMeta>;

export const cars: ModelName[] = ["car-ambulance-pickup", "car-baywatch", "car-hippie-van", "car-passenger-race", "car-passenger", "car-police", "car-taxi", "car-tow-truck", "car-truck-armored-truck", "car-truck-dump", "car-veteran", "truck"];
export const commercialBuildings: ModelName[] = ["commercial-A1", "commercial-A2", "commercial-A3", "commercial-B1", "commercial-B2", "commercial-B3", "commercial-C1", "commercial-C2", "commercial-C3"];
export const otherTiles: ModelName[] = ["grass", "power-line", "under-construction"]
export const industrialBuildings: ModelName[] = ["industrial-A1", "industrial-B1", "industrial-C1", "power-plant"];
export const residentialBuildings: ModelName[] = ["residential-A1", "residential-A2", "residential-A3", "residential-B1", "residential-B2", "residential-B3", "residential-C1", "residential-C2", "residential-C3"]
export const roads: ModelName[] = ["road-corner", "road-end", "road-four-way", "road-straight", "road-three-way"];

export type ModelName = keyof typeof modelsMetaData;

let assetsBaseUrl = appConstants.AssetsBaseUrl;

interface IFastMeshes {
  modelName: ModelName;
  geometry: any,
  material: any;
  instancedMesh: THREE.InstancedMesh;
  index: number;
  count: number;
  freeIndices: number[];
}

export interface IFastMesh {
  parent: IFastMeshes;
  index: number;
  rotation: number;
  scale: number;
}

export interface IAssetOptions {
  zOffset: number;
  scale: number
}

export interface IFootprintPoint {
  x: number;
  z: number;
}

export interface IModelFootprint {
  baseY: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  polygon: IFootprintPoint[];
}

export class AssetManager {
  textureLoader = new THREE.TextureLoader();
  modelLoader = new GLTFLoader();

  textures = {
    'base': this.#loadTexture(`${assetsBaseUrl}textures/base.png`),
    'specular': this.#loadTexture(`${assetsBaseUrl}textures/specular.png`),
    'grid': this.#loadTexture(`${assetsBaseUrl}textures/grid.png`),

  };

  // statusIcons = {
  //   'no-power': this.#loadTexture(`${assetsBaseUrl}statusIcons/no-power.png`, true),
  //   'no-road-access': this.#loadTexture(`${assetsBaseUrl}statusIcons/no-road-access.png`, true)
  // }

  models: Record<ModelName, THREE.Mesh> = {} as any;
  fastMeshes: Record<string, IFastMeshes> = {};
  modelFootprints: Partial<Record<ModelName, IModelFootprint>> = {};

  sprites = {};
  modelCount!: number;
  loadedModelCount!: number;

  constructor(readonly scene: Scene3D) {
  }

  async init() {
    this.modelCount = Object.keys(modelsMetaData).length;
    this.loadedModelCount = 0;

    await Promise.all(Object.entries(modelsMetaData).map(async ([name, meta]) => {
      let updateMaterials = 'updateMaterials' in meta ? meta.updateMaterials : true;
      const model = await this.#loadModel(meta, { updateMaterials });
      const modelName = name as ModelName;
      this.models[modelName] = model;
      if (meta.type === 'zone') {
        this.modelFootprints[modelName] = this.#computeModelFootprint(model);
      }
      this.loadedModelCount += 1;
    }));

  }

  addFastMesh(modelName: ModelName, x: number, y: number, z: number, rotation: number, options?: IAssetOptions): IFastMesh {
    let fastMeshes = this.fastMeshes[modelName];
    if (!fastMeshes) {
      fastMeshes = this.#createFastMesh(modelName, fastMeshes, options);

    }
    const hasFreeSlot = fastMeshes.freeIndices.length > 0;
    if (!hasFreeSlot && fastMeshes.index >= fastMeshes.count) {
      this.#growFastMesh(fastMeshes);
    }
    const instanceIndex = hasFreeSlot ? fastMeshes.freeIndices.pop()! : fastMeshes.index++;
    let result: IFastMesh = {
      rotation,
      scale: options?.scale ?? 1,
      parent: fastMeshes,
      index: instanceIndex
    };
    this.moveFastMesh(result, x, y, z, rotation, options?.scale);
    return result;
  }

  removeFastMesh(fastMesh: IFastMesh) {
    let fastMeshes = fastMesh.parent;
    let instancedMesh = fastMeshes.instancedMesh;

    // Mark slot hidden and reusable; do not mutate capacity.
    instancedMesh.setMatrixAt(fastMesh.index, HIDE_MATRIX);
    instancedMesh.instanceMatrix.needsUpdate = true;
    fastMeshes.freeIndices.push(fastMesh.index);
  }

  #createFastMesh(modelName: ModelName, fastMeshes: IFastMeshes, options?: IAssetOptions) {
    let originalMesh = this.models[modelName];
    let actualMesh = originalMesh as any;
    let { geometry, material } = actualMesh;
    if (!geometry || !material) {
      // we need a mesh with material in order to use InstancedMesh
      originalMesh.updateMatrixWorld();
      const merged = mergeMeshesWithGroups(actualMesh);
      geometry = merged.geometry;
      material = merged.materials;
    }
    if (options && options.zOffset) {
      geometry.translate(0, 0, options.zOffset);
    }

    let count = appConstants.MeshInstancesMin;
    fastMeshes = {
      modelName,
      instancedMesh: new THREE.InstancedMesh(geometry, material, count),
      count,
      geometry,
      material,
      index: 0,
      freeIndices: []
    };

    this.#clearFastMeshes(fastMeshes, 1);

    const meta = modelsMetaData[modelName];
    if (meta.type === 'zone') {
      fastMeshes.instancedMesh.userData.selectableType = 'building';
      fastMeshes.instancedMesh.userData.modelName = modelName;
    }

    this.scene.scene.add(fastMeshes.instancedMesh);
    this.fastMeshes[modelName] = fastMeshes;
    return fastMeshes;
  }

  #clearFastMeshes(fastMeshes: IFastMeshes, from: number) {
    for (let i = from; i < fastMeshes.count; i++) {
      fastMeshes.instancedMesh.setMatrixAt(i, HIDE_MATRIX);
    }
    fastMeshes.instancedMesh.frustumCulled = false;
  }

  #growFastMesh(fastMeshes: IFastMeshes) {
    fastMeshes.count = Math.floor(fastMeshes.count * appConstants.MeshInstancesGrowth);
    let oldMesh = fastMeshes.instancedMesh;
    let newMesh = fastMeshes.instancedMesh = new THREE.InstancedMesh(oldMesh.geometry, oldMesh.material, fastMeshes.count);
    let tempMatrix = new THREE.Matrix4();
    for (let i = 0; i < oldMesh.count; i++) {
      oldMesh.getMatrixAt(i, tempMatrix);
      newMesh.setMatrixAt(i, tempMatrix);
    }
    this.#clearFastMeshes(fastMeshes, oldMesh.count)
    this.scene.scene.remove(oldMesh);
    this.scene.scene.add(newMesh);
  }

  moveFastMesh(fastMesh: IFastMesh, x: number, y: number = 0, z: number, rotation?: number, scale?: number) {
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3(x, y, z);
    const rot = rotation ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation) : new THREE.Quaternion();
    const s = scale ?? fastMesh.scale ?? 1;
    matrix.compose(pos, rot, new THREE.Vector3(s, s, s));
    fastMesh.parent.instancedMesh.setMatrixAt(fastMesh.index, matrix);
    fastMesh.parent.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  getModelFootprint(modelName: ModelName): IModelFootprint | undefined {
    return this.modelFootprints[modelName];
  }



  /** Loads the texture at the specified URL   */
  #loadTexture(url: string, flipY = false) {
    const texture = this.textureLoader.load(url)
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = flipY;
    return texture;
  }

  /** Load the 3D models  */
  async #loadModel(meta: IAssetMeta, options: { updateMaterials: boolean }): Promise<THREE.Mesh> {
    let filename = meta.filename;
    let receiveShadow = meta.receiveShadow ?? false;
    let castShadow = meta.castShadow ?? true;
    let scale = meta.scale ?? 1
    let rotation = meta.rotation ?? 0
    const isBuilding = meta.type === 'zone';
    const base = appConstants.ModelNormalizationBase;
    // Buildings are pre-scaled to TileSizeInMetre so addFastMesh can use scale=1.
    const meshScale = isBuilding
      ? scale * appConstants.BuildingsScale / base
      : scale / base;

    return new Promise((resolve, reject) => {
      this.modelLoader.load(`${assetsBaseUrl}models/${filename}`,
        (glb: GLTF) => {
          let mesh: THREE.Mesh = glb.scene! as any;

          mesh.name = filename;
          if (options.updateMaterials) {
            mesh.traverse((obj: any) => {
              //if (obj.material) {
              obj.material = new THREE.MeshLambertMaterial({
                map: this.textures.base,
                specularMap: this.textures.specular
              })
              obj.receiveShadow = receiveShadow;
              obj.castShadow = castShadow;
              //}
            });
          } else {
            console.log("wtf");
          }
          mesh.rotation.set(0, THREE.MathUtils.degToRad(rotation), 0);
          mesh.scale.set(meshScale, meshScale, meshScale);

          if (isBuilding) {
            // Pivot at footprint center (XZ) and ground contact (Y) for precise placement.
            const fp = this.#computeModelFootprint(mesh);
            mesh.position.set(-fp.centerX, -fp.baseY, -fp.centerZ);
          }

          resolve(mesh);
        },
        (_xhr: ProgressEvent<EventTarget>) => {
          //console.log(`${name} ${(xhr.loaded / xhr.total) * 100}% loaded`);
        },
        (error: unknown) => {
          console.error(error);
          reject(error)
        });
    })

  }

  #computeModelFootprint(meshRoot: THREE.Object3D): IModelFootprint {
    meshRoot.updateMatrixWorld(true);
    const worldBox = new THREE.Box3().setFromObject(meshRoot);
    const minY = worldBox.min.y;
    const epsilon = Math.max(0.01, (worldBox.max.y - worldBox.min.y) * 0.03);

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    let found = false;
    const groundPoints: THREE.Vector2[] = [];

    const p = new THREE.Vector3();
    meshRoot.traverse((obj) => {
      const asMesh = obj as THREE.Mesh;
      const geometry = asMesh.geometry as THREE.BufferGeometry | undefined;
      const pos = geometry?.attributes?.position as THREE.BufferAttribute | undefined;
      if (!pos || !asMesh.isMesh) return;

      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(asMesh.matrixWorld);
        if (p.y <= minY + epsilon) {
          found = true;
          groundPoints.push(new THREE.Vector2(p.x, p.z));
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.z < minZ) minZ = p.z;
          if (p.z > maxZ) maxZ = p.z;
        }
      }
    });

    if (!found) {
      minX = worldBox.min.x;
      maxX = worldBox.max.x;
      minZ = worldBox.min.z;
      maxZ = worldBox.max.z;
    }

    const hull = this.#computeConvexHull(groundPoints.length > 2 ? groundPoints : [
      new THREE.Vector2(minX, minZ),
      new THREE.Vector2(maxX, minZ),
      new THREE.Vector2(maxX, maxZ),
      new THREE.Vector2(minX, maxZ),
    ]);

    const margin = appConstants.BuildingsFootprintMarginMetre;
    const inflatedHull = margin > 0 ? this.#inflatePolygon(hull, margin) : hull;

    let outMinX = Number.POSITIVE_INFINITY;
    let outMaxX = Number.NEGATIVE_INFINITY;
    let outMinZ = Number.POSITIVE_INFINITY;
    let outMaxZ = Number.NEGATIVE_INFINITY;
    for (const p of inflatedHull) {
      if (p.x < outMinX) outMinX = p.x;
      if (p.x > outMaxX) outMaxX = p.x;
      if (p.y < outMinZ) outMinZ = p.y;
      if (p.y > outMaxZ) outMaxZ = p.y;
    }

    return {
      baseY: minY,
      centerX: (outMinX + outMaxX) / 2,
      centerZ: (outMinZ + outMaxZ) / 2,
      width: outMaxX - outMinX,
      depth: outMaxZ - outMinZ,
      polygon: inflatedHull.map((pt) => ({ x: pt.x, z: pt.y })),
    };
  }

  #inflatePolygon(points: THREE.Vector2[], margin: number): THREE.Vector2[] {
    if (points.length < 3 || margin <= 0) return points;

    let cx = 0;
    let cz = 0;
    for (const p of points) {
      cx += p.x;
      cz += p.y;
    }
    cx /= points.length;
    cz /= points.length;

    return points.map((p) => {
      const dx = p.x - cx;
      const dz = p.y - cz;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) return new THREE.Vector2(p.x, p.y);
      const inv = margin / len;
      return new THREE.Vector2(p.x + dx * inv, p.y + dz * inv);
    });
  }

  #computeConvexHull(points: THREE.Vector2[]): THREE.Vector2[] {
    if (points.length <= 3) return points;

    const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
    const cross = (o: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) => {
      return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    };

    const lower: THREE.Vector2[] = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }

    const upper: THREE.Vector2[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }

    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }
}


export function mergeMeshesWithGroups(object: THREE.Object3D, _ignored?: boolean): { geometry: THREE.BufferGeometry, materials: THREE.Material[] } {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const materialIndexMap = new Map<THREE.Material, number>();
  let groupOffset = 0;

  object.traverse((child: any) => {
    if (child.isMesh && child.geometry && child.material) {
      const geom = child.geometry.clone();
      geom.applyMatrix4(child.matrixWorld);

      let matIndex = materialIndexMap.get(child.material);
      if (matIndex === undefined) {
        matIndex = materials.length;
        materials.push(child.material);
        materialIndexMap.set(child.material, matIndex);
      }

      geom.groups.forEach((g: any) => {
        geom.addGroup(g.start + groupOffset, g.count, matIndex!);
      });

      if (geom.groups.length === 0) {
        geom.addGroup(0 + groupOffset, geom.index?.count || geom.attributes.position.count, matIndex!);
      }

      groupOffset += geom.index?.count || geom.attributes.position.count;
      geometries.push(geom);
    }
  });

  const merged = BufferGeometryUtils.mergeGeometries(geometries, true);
  return { geometry: merged, materials };
}
