import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import models from './models.js';

const baseUrl = './';
export class AssetManager {
  textureLoader = new THREE.TextureLoader();
  modelLoader = new GLTFLoader();

  textures = {
    'base': this.#loadTexture(`${baseUrl}textures/base.png`),
    'specular': this.#loadTexture(`${baseUrl}textures/specular.png`),
    'grid': this.#loadTexture(`${baseUrl}textures/grid.png`),

  };

  statusIcons = {
    'no-power': this.#loadTexture(`${baseUrl}statusIcons/no-power.png`, true),
    'no-road-access': this.#loadTexture(`${baseUrl}statusIcons/no-road-access.png`, true)
  }

  models: Record<string, THREE.Mesh> = {};

  sprites = {};
  modelCount!: number;
  loadedModelCount!: number;
  onLoad: any;

  constructor() { }

  init(onLoad: () => void) {
    this.modelCount = Object.keys(models).length;
    this.loadedModelCount = 0;

    for (const [name, meta] of Object.entries(models)) {
      this.#loadModel(name, meta);
    }

    this.onLoad = onLoad;
  }

  /**
   * Returns a cloned copy of a mesh
   * @param {string} name The name of the mesh to retrieve
   * @param {Object} simObject The SimObject object that corresponds to this mesh
   * @param {boolean} transparent True if materials should be transparent. Default is false.
   * @returns {THREE.Mesh}
   */
  getModel(name: string, simObject: any, transparent = false): THREE.Mesh {
    const mesh = this.models[name].clone();

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

  /**
   * Loads the texture at the specified URL
   * @param {string} url 
   * @returns {THREE.Texture} A texture object
   */
  #loadTexture(url: string, flipY = false) {
    const texture = this.textureLoader.load(url)
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = flipY;
    return texture;
  }

  /**
   * Load the 3D models
   * @param {string} url The URL of the model to load
   */
  #loadModel(name: string | number, { filename, scale = 1, rotation = 0, receiveShadow = true, castShadow = true }: any) {
    this.modelLoader.load(`${baseUrl}models/${filename}`,
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

        // Once all models are loaded
        this.loadedModelCount++;
        if (this.loadedModelCount == this.modelCount) {
          this.onLoad()
        }
      },
      (_xhr: any) => {
        //console.log(`${name} ${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      (error) => {
        console.error(error);
      });
  }
}