import { For, JSXElement } from 'solid-js';
import config from '../../../config.js';
import { Citizen } from '../../citizen.js';
import { City } from '../../city.js';
import { Zone } from '../zones/zone.jsx';
import { DevelopmentState } from './development.js';
import { SimModule } from './simModule.js';
import { IStoreGameData } from '../../../storage/GameStorage.js';

/**
 * Logic for residents moving into and out of a building
 */
export interface IResidentsData {
  residents: number;
}
export class ResidentsModule extends SimModule implements IStoreGameData<IResidentsData> {

  /**
   * @type {ResidentialZone}
   */
  #zone;

  /**
   * @type {Citizen[]}
   */
  #residents: Citizen[] = [];

  /**
   * @param {ResidentialZone} zone 
   */
  constructor(zone: Zone) {
    super();
    this.#zone = zone;
  }

  /**
   * Returns the number of residents
   * @type {number}
   */
  get count() {
    return this.#residents.length;
  }

  setCount(residents: number) {
    if (this.#residents.length > residents) this.#residents.length = residents;
    else {
      while (this.#residents.length < residents) {
        this.#residents.push(new Citizen(this.#zone));
      }
    }
  }

  /**
   * Maximuim number of residents that can live in this building
   * @returns {number}
   */
  get maximum() {
    return Math.pow(config.modules.residents.maxResidents, this.#zone.development.level);
  }

  /**
   * @param {City} city 
   */
  simulate(city: City) {
    // If building is abandoned, all residents are evicted and no more residents are allowed to move in.
    if (this.#zone.development.state === DevelopmentState.abandoned && this.#residents.length > 0) {
      this.#evictAll();
    } else if (this.#zone.development.state === DevelopmentState.developed) {
      // Move in new residents if there is room
      if (this.#residents.length < this.maximum && Math.random() < config.modules.residents.residentMoveInChance) {
        this.#residents.push(new Citizen(this.#zone));
      }
    }

    for (const resident of this.#residents) {
      resident.simulate(city);
    }
  }

  /**
   * Evicts all residents from the building
   */
  #evictAll() {
    for (const resident of this.#residents) {
      resident.dispose();
    }
    this.#residents = [];
  }

  /**
   * Handles any clean up needed before a building is removed
   */
  dispose() {
    this.#evictAll();
  }

  /**
   * Returns an HTML representation of this object
   * @returns {string}
   */
  toHTML(): JSXElement {
    return (<>
      <div class="info-heading">Residents ({this.#residents.length}/{this.maximum})</div>
      <ul class="info-citizen-list">
        <For each={this.#residents}>
          {resident => resident.toHTML()}
        </For>
      </ul>

    </>);
  }

  loadGameData(data: IResidentsData): void {
    this.setCount(data.residents);
  }
  saveGameData(target: IResidentsData): void {
    target.residents = this.#residents.length;
  }

}