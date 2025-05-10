


export function toGrid(value: BitGrid): boolean[][] {
  const grid: boolean[][] = [];
  for (let y = 0; y < 5; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < 5; x++) {
      const bitIndex = y * 5 + x;
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
  for (let y = 0; y < 5; y++) {
    let on: number[] = [];
    let off: number[] = [];
    for (let x = 0; x < 5; x++) {
      let bitNo = y * 5 + x;
      on.push(1 << bitNo);
      off.push(allBits & ~(1 << bitNo));
    }
    onBits.push(on);
    offBits.push(off)
  }
}

export function setGridBit(grid: BitGrid, x: number, y: number): BitGrid {
  return grid | onBits[y][x];
}

export function clearGridBit(grid: BitGrid, x: number, y: number): BitGrid {
  return grid & offBits[y][x];
}

export type BitGrid = number;

