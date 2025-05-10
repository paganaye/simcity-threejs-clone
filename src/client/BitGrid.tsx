


export function toGrid(value: BitGrid): boolean[][] {
  const grid: boolean[][] = [];
  for (let z = 0; z < 5; z++) {
    const row: boolean[] = [];
    for (let x = 0; x < 5; x++) {
      const bitIndex = z * 5 + x;
      row.push(((value >> bitIndex) & 1) === 1);
    }
    grid.push(row);
  }
  return grid;
}
const onBits: number[][] = [];
const offBits: number[][] = [];
initBits();

function initBits() {
  const allBits = (1 << 25) - 1;
  for (let z = 0; z < 5; z++) {
    let on: number[] = [];
    let off: number[] = [];
    for (let x = 0; x < 5; x++) {
      let bitNo = z * 5 + x;
      on.push(1 << bitNo);
      off.push(allBits & ~(1 << bitNo));
    }
    onBits.push(on);
    offBits.push(off)
  }
}

export function setGridBit(grid: BitGrid, x: number, z: number): BitGrid {
  return grid | onBits[z][x];
}

export function clearGridBit(grid: BitGrid, x: number, z: number): BitGrid {
  return grid & offBits[z][x];
}

export type BitGrid = number;

