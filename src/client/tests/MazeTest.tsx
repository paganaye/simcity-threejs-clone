import * as THREE from "three";
import { Page } from "../Page";
import { Character } from "../Character";

export default class MazeTest extends Page {
  private maze: boolean[][] = [];
  private wallMesh?: THREE.InstancedMesh;
  private floorMesh?: THREE.Mesh;
  private walkerMesh?: THREE.InstancedMesh;
  private readonly walkerCharacter = new Character();
  private readonly walkerPosition = new THREE.Vector3();
  private readonly walkerScale = new THREE.Vector3(1, 1, 1);
  private walkerPath: Array<{ x: number; y: number }> = [];
  private walkerNextWaypoint = 1;
  private walkerSpeed = 1.4;
  private walkerLastElapsed = 0;
  private walkerWalkData?: Float32Array;
  private walkerWalkAttr?: THREE.InstancedBufferAttribute;
  private readonly mazeWidth = 41;
  private readonly mazeHeight = 41;
  private readonly wallHeight = 1;
  private onKeyDown?: (event: KeyboardEvent) => void;

  run(): Promise<void> | void {
    this.generateAndRenderMaze();

    this.onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "r") {
        this.generateAndRenderMaze();
      }
    };
    window.addEventListener("keydown", this.onKeyDown);

    // Recenter camera to frame the maze nicely.
    this.camera.position.set(0, 22, 22);
    this.camera.lookAt(0, 0, 0);
    this.controls?.target.set(0, 0, 0);
    this.controls?.update();
  }

  override loop(elapsed: number): void {
    this.walkerCharacter.updateAnimation(elapsed);

    if (!this.walkerMesh || this.walkerPath.length < 2) {
      return;
    }

    const delta = this.walkerLastElapsed === 0 ? 0 : elapsed - this.walkerLastElapsed;
    this.walkerLastElapsed = elapsed;

    if (delta <= 0) {
      return;
    }

    if (this.walkerNextWaypoint >= this.walkerPath.length) {
      this.setWalkerWalking(false);
      return;
    }

    const targetCell = this.walkerPath[this.walkerNextWaypoint];
    const target = this.cellToWorld(targetCell.x, targetCell.y);
    const dx = target.x - this.walkerPosition.x;
    const dz = target.z - this.walkerPosition.z;
    const distance = Math.hypot(dx, dz);

    if (distance < 0.0001) {
      this.walkerPosition.copy(target);
      this.walkerNextWaypoint += 1;
      this.updateWalkerMatrix(this.walkerPosition, 0);
      return;
    }

    const heading = Math.atan2(dx, dz);
    const step = this.walkerSpeed * delta;

    if (step >= distance) {
      this.walkerPosition.copy(target);
      this.walkerNextWaypoint += 1;
    } else {
      const inv = 1 / distance;
      this.walkerPosition.x += dx * inv * step;
      this.walkerPosition.z += dz * inv * step;
    }

    this.updateWalkerMatrix(this.walkerPosition, heading);

    if (this.walkerNextWaypoint >= this.walkerPath.length) {
      this.setWalkerWalking(false);
    }
  }

  override cleanup(): void {
    if (this.onKeyDown) {
      window.removeEventListener("keydown", this.onKeyDown);
      this.onKeyDown = undefined;
    }

    if (this.wallMesh) {
      this.scene.remove(this.wallMesh);
      this.wallMesh.geometry.dispose();
      if (Array.isArray(this.wallMesh.material)) {
        this.wallMesh.material.forEach((m) => m.dispose());
      } else {
        this.wallMesh.material.dispose();
      }
      this.wallMesh = undefined;
    }

    if (this.floorMesh) {
      this.scene.remove(this.floorMesh);
      this.floorMesh.geometry.dispose();
      if (Array.isArray(this.floorMesh.material)) {
        this.floorMesh.material.forEach((m) => m.dispose());
      } else {
        this.floorMesh.material.dispose();
      }
      this.floorMesh = undefined;
    }

    if (this.walkerMesh) {
      this.scene.remove(this.walkerMesh);
      this.walkerMesh.geometry.dispose();
      if (Array.isArray(this.walkerMesh.material)) {
        this.walkerMesh.material.forEach((m) => m.dispose());
      } else {
        this.walkerMesh.material.dispose();
      }
      this.walkerMesh = undefined;
      this.walkerWalkData = undefined;
      this.walkerWalkAttr = undefined;
    }
  }

  private generateAndRenderMaze(): void {
    this.maze = this.generateMazeDFS(this.mazeWidth, this.mazeHeight);
    this.renderMaze(this.maze);
    this.setupWalkerPath();
    this.walkerLastElapsed = 0;
  }

  private generateMazeDFS(width: number, height: number): boolean[][] {
    const w = width % 2 === 0 ? width + 1 : width;
    const h = height % 2 === 0 ? height + 1 : height;

    const grid: boolean[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => true));
    const stack: Array<{ x: number; y: number }> = [];
    const directions = [
      { dx: 2, dy: 0 },
      { dx: -2, dy: 0 },
      { dx: 0, dy: 2 },
      { dx: 0, dy: -2 },
    ];

    const start = { x: 1, y: 1 };
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

  private renderMaze(grid: boolean[][]): void {
    if (this.wallMesh) {
      this.scene.remove(this.wallMesh);
      this.wallMesh.geometry.dispose();
      if (Array.isArray(this.wallMesh.material)) {
        this.wallMesh.material.forEach((m) => m.dispose());
      } else {
        this.wallMesh.material.dispose();
      }
      this.wallMesh = undefined;
    }

    if (this.floorMesh) {
      this.scene.remove(this.floorMesh);
      this.floorMesh.geometry.dispose();
      if (Array.isArray(this.floorMesh.material)) {
        this.floorMesh.material.forEach((m) => m.dispose());
      } else {
        this.floorMesh.material.dispose();
      }
      this.floorMesh = undefined;
    }

    const height = grid.length;
    const width = grid[0]?.length ?? 0;

    const wallCount = grid.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
    const wallGeometry = new THREE.BoxGeometry(1, this.wallHeight, 1);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
    const walls = new THREE.InstancedMesh(wallGeometry, wallMaterial, wallCount);

    const offsetX = -(width - 1) / 2;
    const offsetZ = -(height - 1) / 2;
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    let index = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!grid[y][x]) {
          continue;
        }
        pos.set(offsetX + x, this.wallHeight / 2, offsetZ + y);
        matrix.compose(pos, quat, scale);
        walls.setMatrixAt(index++, matrix);
      }
    }
    walls.instanceMatrix.needsUpdate = true;
    this.wallMesh = walls;
    this.scene.add(walls);

    const floorGeometry = new THREE.PlaneGeometry(width, height);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x2e2e2e, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    this.floorMesh = floor;
    this.scene.add(floor);
  }

  private setupWalkerPath(): void {
    this.ensureWalkerMesh();

    const h = this.maze.length;
    const w = this.maze[0]?.length ?? 0;
    const start = { x: 0, y: 1 };
    const goal = { x: w - 1, y: h - 2 };

    this.walkerPath = this.findPathBFS(this.maze, start, goal);
    this.walkerNextWaypoint = Math.min(1, this.walkerPath.length - 1);

    const initialCell = this.walkerPath[0] ?? start;
    const initialPosition = this.cellToWorld(initialCell.x, initialCell.y);
    this.walkerPosition.copy(initialPosition);

    const initialHeading = this.walkerPath.length > 1
      ? Math.atan2(
        this.cellToWorld(this.walkerPath[1].x, this.walkerPath[1].y).x - initialPosition.x,
        this.cellToWorld(this.walkerPath[1].x, this.walkerPath[1].y).z - initialPosition.z
      )
      : 0;

    this.updateWalkerMatrix(initialPosition, initialHeading);
    this.setWalkerWalking(this.walkerPath.length > 1);
  }

  private ensureWalkerMesh(): void {
    if (this.walkerMesh) {
      return;
    }

    const geometry = this.walkerCharacter.createGeometry();
    const material = this.walkerCharacter.createMaterial();
    this.walkerMesh = new THREE.InstancedMesh(geometry, material, 1);
    this.scene.add(this.walkerMesh);

    this.walkerWalkData = new Float32Array([1]);
    const walkPhase = new Float32Array([Math.random() * Math.PI * 2]);
    this.walkerWalkAttr = new THREE.InstancedBufferAttribute(this.walkerWalkData, 1);

    geometry.setAttribute("aWalk", this.walkerWalkAttr);
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(walkPhase, 1));
  }

  private setWalkerWalking(isWalking: boolean): void {
    if (!this.walkerWalkData || !this.walkerWalkAttr) {
      return;
    }
    this.walkerWalkData[0] = isWalking ? 1 : 0;
    this.walkerWalkAttr.needsUpdate = true;
  }

  private updateWalkerMatrix(position: THREE.Vector3, heading: number): void {
    if (!this.walkerMesh) {
      return;
    }
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
    this.walkerScale.set(1, 1, 1);
    matrix.compose(position, quat, this.walkerScale);
    this.walkerMesh.setMatrixAt(0, matrix);
    this.walkerMesh.instanceMatrix.needsUpdate = true;
  }

  private cellToWorld(x: number, y: number): THREE.Vector3 {
    const width = this.maze[0]?.length ?? this.mazeWidth;
    const height = this.maze.length || this.mazeHeight;
    const offsetX = -(width - 1) / 2;
    const offsetZ = -(height - 1) / 2;
    return new THREE.Vector3(offsetX + x, 0, offsetZ + y);
  }

  private findPathBFS(
    grid: boolean[][],
    start: { x: number; y: number },
    goal: { x: number; y: number }
  ): Array<{ x: number; y: number }> {
    const height = grid.length;
    const width = grid[0]?.length ?? 0;
    const key = (x: number, y: number) => `${x},${y}`;
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    const queue: Array<{ x: number; y: number }> = [start];
    const visited = new Set<string>([key(start.x, start.y)]);
    const parent = new Map<string, { x: number; y: number }>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.x === goal.x && current.y === goal.y) {
        const path: Array<{ x: number; y: number }> = [];
        let cur: { x: number; y: number } | undefined = current;
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
