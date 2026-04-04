export type GridPoint = { x: number; y: number };

export class MazeBuilder {
  buildDFS(width: number, height: number): boolean[][] {
    const w = width % 2 === 0 ? width + 1 : width;
    const h = height % 2 === 0 ? height + 1 : height;

    const grid: boolean[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => true));
    const stack: GridPoint[] = [];
    const directions = [
      { dx: 2, dy: 0 },
      { dx: -2, dy: 0 },
      { dx: 0, dy: 2 },
      { dx: 0, dy: -2 },
    ];

    const start: GridPoint = { x: 1, y: 1 };
    grid[start.y][start.x] = false;
    stack.push(start);

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors = directions
        .map((d) => ({
          nx: current.x + d.dx,
          ny: current.y + d.dy,
          wx: current.x + d.dx / 2,
          wy: current.y + d.dy / 2,
        }))
        .filter((n) => n.nx > 0 && n.nx < w - 1 && n.ny > 0 && n.ny < h - 1 && grid[n.ny][n.nx]);

      if (neighbors.length === 0) {
        stack.pop();
        continue;
      }

      const picked = neighbors[Math.floor(Math.random() * neighbors.length)];
      grid[picked.wy][picked.wx] = false;
      grid[picked.ny][picked.nx] = false;
      stack.push({ x: picked.nx, y: picked.ny });
    }

    // Entrance / exit
    grid[1][0] = false;
    grid[h - 2][w - 1] = false;

    return grid;
  }
}
