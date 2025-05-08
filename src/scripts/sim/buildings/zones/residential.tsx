import { IZoneData, Zone } from './zone.js';
import { ResidentsModule, IResidentsData } from '../modules/residents.js';
import { BuildingType } from '../buildingType.js';
import { JSXElement } from 'solid-js';


interface IResidentialData extends IZoneData, IResidentsData {
}
export class ResidentialZone extends Zone<IResidentialData> {
  type = BuildingType.residential;
  /**
   * @type {ResidentsModule}
   */
  residents: ResidentsModule = new ResidentsModule(this);

  constructor(x: number, y: number) {
    super(x, y);
    this.name = generateBuildingName();
  }

  /**
   * Steps the state of the zone forward in time by one simulation step
   * @param {City} city 
   */
  simulate() {
    super.simulate();
    this.residents.simulate();
  }

  /**
   * Handles any clean up needed before a building is removed
   */
  dispose() {
    this.residents.dispose();
    super.dispose();
  }

  /**
   * Returns an HTML representation of this object
   * @returns {string}
   */
  toHTML(): JSXElement {
    return <>
      {super.toHTML()}
      {this.residents.toHTML()}
    </>
  }

  override saveGameData(target: IResidentialData): void {
    super.saveGameData(target);
    this.residents.saveGameData(target);
  }

  override loadGameData(data: IResidentialData): void {
    super.loadGameData(data);
    this.residents.loadGameData(data);
  }
}

// Arrays of different name components
const prefixes = ['Emerald', 'Ivory', 'Crimson', 'Opulent', 'Celestial', 'Enchanted', 'Serene', 'Whispering', 'Stellar', 'Tranquil'];
const suffixes = ['Tower', 'Residence', 'Manor', 'Court', 'Plaza', 'House', 'Mansion', 'Place', 'Villa', 'Gardens'];

// Function to generate a random building name
function generateBuildingName() {
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

  return prefix + ' ' + suffix;
}