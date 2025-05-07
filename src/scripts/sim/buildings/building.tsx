import * as THREE from 'three';
import { SimObject } from '../simObject';
import { PowerModule } from './modules/power';
import { RoadAccessModule } from './modules/roadAccess';
import { assetManager } from '../../../App';
import { JobsModule } from './modules/jobs';
import { City } from '../city';
import { ResidentsModule } from './modules/residents';
import { JSXElement, Show } from 'solid-js';
import { IStoreGameData } from '../../storage/GameStorage';

export type BuildingStatus = 'no-power' | 'no-road-access' | 'OK';


export abstract class Building<TGameData = any> extends SimObject implements IStoreGameData<TGameData> {
  /** The building type */
  abstract type: string; // 'building';
  /** True if the terrain should not be rendered with this building type */
  hideTerrain = false;
  power = new PowerModule();
  roadAccess = new RoadAccessModule(this);
  /** The current status of the building */
  status: BuildingStatus = 'OK';
  /** Icon displayed when building status */
  #statusIcon = new THREE.Sprite();

  jobs: JobsModule | undefined;
  residents: ResidentsModule | undefined;
  powerConsumed: number = 0;
  abstract refreshView(city: City): void;

  constructor(x: number, y: number) {
    super(x, y);
    this.#statusIcon.visible = false;
    this.#statusIcon.material = new THREE.SpriteMaterial({ depthTest: false })
    this.#statusIcon.layers.set(1);
    this.#statusIcon.scale.set(0.5, 0.5, 0.5);
    this.add(this.#statusIcon);

  }

  /**
   * 
   * @param {*} status 
   */
  setStatus(status: BuildingStatus) {
    if (status !== this.status) {
      switch (status) {
        case 'no-power':
          this.#statusIcon.visible = true;
          this.#statusIcon.material.map = (assetManager.statusIcons as any)[status];
          break;
        case 'no-road-access':
          this.#statusIcon.visible = true;
          this.#statusIcon.material.map = (assetManager.statusIcons as any)[status];
          break;
        default:
          this.#statusIcon.visible = false;
      }
      this.status = status;
    }
  }

  simulate(city: City) {
    super.simulate(city);

    this.power.simulate(city);
    this.roadAccess.simulate(city);

    if (!this.power.isFullyPowered) {
      this.setStatus('no-power');
    } else if (!this.roadAccess.value) {
      this.setStatus('no-road-access');
    } else {
      this.setStatus('OK');
    }
  }

  dispose() {
    this.power.dispose();
    this.roadAccess.dispose();
    super.dispose();
  }

  /**
   * Returns an HTML representation of this object
   * @returns {string}
   */
  toHTML(): JSXElement {
    return <>
      <div class="info-heading">Building</div>
      <span class="info-label">Name </span>
      <span class="info-value">{this.name}</span>
      <br />
      <span class="info-label">Type </span>
      <span class="info-value">{this.type}</span>
      <br />
      <span class="info-label">Road Access </span>
      <span class="info-value">{this.roadAccess.value}</span>
      <br />
      <br />
      <Show when={this.power.required}>
        <span class="info-label">Power (kW)</span>
        <span class="info-value">{this.power.supplied}/{this.power.required}</span>
      </Show>
    </>
  }

  loadGameData(_data: TGameData): void { }
  saveGameData(_target: TGameData): void { }

}