import { JobsModule } from '../modules/jobs.js';
import { BuildingType } from '../buildingType.js';
import { Zone } from './zone.js';
import { JSXElement } from 'solid-js';

export class IndustrialZone extends Zone {
  type = BuildingType.industrial;

  /**
   * @type {JobsModule}
   */
  jobs: JobsModule = new JobsModule(this);

  constructor(x: number, y: number) {
    super(x, y);
    this.name = generateBusinessName();
  }

  /**
   * Steps the state of the zone forward in time by one simulation step
   * @param {City} city 
   */
  simulate() {
    super.simulate();
    this.jobs.simulate();
  }

  /**
   * Handles any clean up needed before a building is removed
   */
  dispose() {
    this.jobs.dispose();
    super.dispose();
  }

  /** Returns an HTML representation of this object  */
  toHTML(): JSXElement {
    return (<>
      {super.toHTML()}
      {this.jobs.toHTML()}
    </>)
  }
}

// Arrays of words for generating business names
const prefixes = ['Apex', 'Vortex', 'Elevate', 'Zenith', 'Nova', 'Synapse', 'Pulse', 'Enigma', 'Catalyst', 'Axiom'];
const suffixes = ['Dynamics', 'Ventures', 'Solutions', 'Technologies', 'Innovations', 'Industries', 'Enterprises', 'Systems', 'Mechanics', 'Manufacturing'];
const businessSuffixes = ['LLC', 'Inc.', 'Co.', 'Corp.', 'Ltd.'];

// Function to generate a random industrial business name
function generateBusinessName() {
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  const businessSuffix = businessSuffixes[Math.floor(Math.random() * businessSuffixes.length)];

  return prefix + ' ' + suffix + ' ' + businessSuffix;
}