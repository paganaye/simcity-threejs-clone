import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { appConstants } from '../AppConstants';

export interface IAsset {
  type: 'zone' | 'road' | 'vehicle' | 'power' | "terrain",
  filename: string;
  scale?: number;
  castShadow?: boolean;
  rotation?: number;
}

const models = {
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
  "industrial-A2": {
    "type": "zone",
    "filename": "industry-factory.glb"
  },
  "industrial-B2": {
    "type": "zone",
    "filename": "industry-refinery.glb"
  },
  "industrial-C2": {
    "type": "zone",
    "filename": "industry-warehouse.glb"
  },
  "industrial-A3": {
    "type": "zone",
    "filename": "industry-factory.glb"
  },
  "industrial-B3": {
    "type": "zone",
    "filename": "industry-refinery.glb"
  },
  "industrial-C3": {
    "type": "zone",
    "filename": "industry-warehouse.glb"
  },
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
} satisfies Record<string, IAsset>;

export type ModelName = keyof typeof models;

let assetsBaseUrl = appConstants.assetsBaseUrl;

export class AssetManager {
  textureLoader = new THREE.TextureLoader();
  modelLoader = new GLTFLoader();

  textures = {
    'base': this.#loadTexture(`${assetsBaseUrl}textures/base.png`),
    'specular': this.#loadTexture(`${assetsBaseUrl}textures/specular.png`),
    'grid': this.#loadTexture(`${assetsBaseUrl}textures/grid.png`),

  };

  statusIcons = {
    'no-power': this.#loadTexture(`${assetsBaseUrl}statusIcons/no-power.png`, true),
    'no-road-access': this.#loadTexture(`${assetsBaseUrl}statusIcons/no-road-access.png`, true)
  }

  models: Record<string, THREE.Mesh> = {};

  sprites = {};
  modelCount!: number;
  loadedModelCount!: number;

  constructor() {
  }

  async init() {
    this.modelCount = Object.keys(models).length;
    this.loadedModelCount = 0;

    await Promise.all(Object.entries(models).map(([name, meta]) => this.#loadModel(name, meta)));
  }

  getModel(name: ModelName, simObject: any, transparent = false): THREE.Mesh {
    let model = this.models[name];
    if (!model) {
      throw Error("unknown model " + name);
    }
    const mesh = model.clone();

    // Clone materials so each object has a unique material
    // This is so we can set the modify the texture of each
    // mesh independently (e.g. highlight on mouse over,
    // abandoned buildings, etc.))
    mesh.traverse((obj: THREE.Object3D) => {
      obj.userData = simObject;
      if ('material' in obj) {
        if (Array.isArray(obj.material)) {
          throw Error("Material Array cloning not implemented");
        } else if (obj.material) {
          obj.material = (obj.material as THREE.MeshStandardMaterial).clone();
          (obj.material as THREE.MeshStandardMaterial).transparent = transparent;
        }
      }
    });

    return mesh;
  }

  /** Loads the texture at the specified URL   */
  #loadTexture(url: string, flipY = false) {
    const texture = this.textureLoader.load(url)
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = flipY;
    return texture;
  }

  /** Load the 3D models  */
  async #loadModel(name: string | number, { filename, scale = 1, rotation = 0, receiveShadow = true, castShadow = true }: any) {
    return new Promise((resolve, reject) => {
      this.modelLoader.load(`${assetsBaseUrl}models/${filename}`,
        (glb) => {
          let mesh: THREE.Mesh = glb.scene! as any;

          mesh.name = filename;

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

          mesh.rotation.set(0, THREE.MathUtils.degToRad(rotation), 0);
          mesh.scale.set(scale / 30, scale / 30, scale / 30);

          this.models[name] = mesh;

          this.loadedModelCount++;
          resolve(undefined);
        },
        (_xhr: any) => {
          //console.log(`${name} ${(xhr.loaded / xhr.total) * 100}% loaded`);
        },
        (error) => {
          console.error(error);
          reject(error)
        });
    })

  }
}