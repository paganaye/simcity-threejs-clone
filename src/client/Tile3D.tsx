import { JSXElement } from 'solid-js';
import { MeshSignal } from './MeshSignal.jsx';


export class Tile3D {

  readonly floor = new MeshSignal();
  readonly building = new MeshSignal();


  constructor(readonly x: number, readonly y: number) {

  }





  toHTML(): JSXElement {
    return <>
      <div class="info-heading">Tile</div>
      <span class="info-label">Coordinates </span>
      <span class="info-value">X: {this.x}, Y: {this.y}</span>
      <br />
      <span class="info-label">Terrain </span>
      {/*<span class="info-value">{this.terrain}</span>*/}
      <br />
      {/* {this.building?.toHTML()} */}
    </>;
  }
};



