import type { GridPoint } from "./MazeBuilder";

export class PathFinder {
  findPathBFS(grid: boolean[][], start: GridPoint, goal: GridPoint): GridPoint[] {
    const height = grid.length;
    const width = grid[0]?.length ?? 0;
    const key = (x: number, y: number) => `${x},${y}`;
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    const queue: GridPoint[] = [start];
    const visited = new Set<string>([key(start.x, start.y)]);
    const parent = new Map<string, GridPoint>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      if (current.x === goal.x && current.y === goal.y) {
        const path: GridPoint[] = [];
        let cur: GridPoint | undefined = current;
        while (cur) {
          path.push(cur);
          cur = parent.get(key(cur.x, cur.y));
        }
        path.reverse();
        return path;
      }

      for (const dir of directions) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;

        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          continue;
        }
        if (grid[ny][nx]) {
          continue;
        }

        const k = key(nx, ny);
        if (visited.has(k)) {
          continue;
        }
        visited.add(k);
        parent.set(k, current);
        queue.push({ x: nx, y: ny });
      }
    }

    // Fallback to start if no path found (should not happen with this maze generation).
    return [start];
  }
}
