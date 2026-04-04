import * as THREE from "three";
import { Page } from "../Page";
import { Character } from "../Character";
import { CharacterPath } from "../CharacterPath";
import { MazeBuilder, type GridPoint } from "./MazeBuilder";
import { PathFinder } from "./PathFinder";

export default class MazeTest extends Page {
  private maze: boolean[][] = [];
  private wallMesh?: THREE.InstancedMesh;
  private floorMesh?: THREE.Mesh;
  private walkerMesh?: THREE.InstancedMesh;
  private readonly walkerCharacter = new Character();
  private readonly walkerScale = new THREE.Vector3(1, 1, 1);
  private walkerLastElapsed = 0;
  private walkerWalkData?: Float32Array;
  private walkerWalkAttr?: THREE.InstancedBufferAttribute;
  private readonly walkerCount = 4;
  private readonly walkers: Character[] = Array.from({ length: this.walkerCount }, () => new Character());
  private readonly walkerCurrentCells: GridPoint[] = [];
  private readonly walkerTargetCells: GridPoint[] = [];
  private readonly mazeBuilder = new MazeBuilder();
  private readonly pathFinder = new PathFinder();
  private readonly mazeWidth = 41;
  private readonly mazeHeight = 41;
  private readonly wallHeight = 1;
  private onKeyDown?: (event: KeyboardEvent) => void;

  run(): Promise<void> | void {
    this.walkers.forEach((walker, i) => {
      walker.path = new CharacterPath({ speed: 1.4 + i * 0.15, turnSpeed: 10 });
    });

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

    if (!this.walkerMesh || !this.walkerWalkData || !this.walkerWalkAttr) {
      return;
    }

    const delta = this.walkerLastElapsed === 0 ? 0 : elapsed - this.walkerLastElapsed;
    this.walkerLastElapsed = elapsed;

    if (delta <= 0) {
      return;
    }

    for (let i = 0; i < this.walkerCount; i++) {
      const path = this.walkers[i].path;
      if (!path) {
        continue;
      }

      const update = path.update(delta, (x, y) => this.cellToWorld(x, y));
      this.updateWalkerMatrix(i, update.position, update.heading);
      this.setWalkerWalking(i, update.isWalking);

      if (update.reachedEnd) {
        this.setupWalkerPath(i, this.walkerTargetCells[i]);
      }
    }
    this.walkerWalkAttr.needsUpdate = true;
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
    this.maze = this.mazeBuilder.buildDFS(this.mazeWidth, this.mazeHeight);
    const quarterWidth = Math.floor(this.mazeWidth / 4);
    const quarterHeight = Math.floor(this.mazeHeight / 4);

    for (let y = 1; y < this.maze.length - 1; y++) {
      for (let x = 1; x < this.maze[y].length - 1; x++) {
        if (x % quarterWidth === 0 || y % quarterHeight === 0) {
          this.maze[y][x] = false;
        }
      } 
    }
    this.renderMaze(this.maze);
    this.setupWalkerPaths();
    this.walkerLastElapsed = 0;
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

  private setupWalkerPaths(): void {
    this.ensureWalkerMesh();

    for (let i = 0; i < this.walkerCount; i++) {
      const start = this.pickRandomWalkableCell();
      this.setupWalkerPath(i, start);
    }

    if (this.walkerWalkAttr) {
      this.walkerWalkAttr.needsUpdate = true;
    }
  }

  private setupWalkerPath(index: number, startCell?: GridPoint): void {
    const start = startCell ?? this.walkerTargetCells[index] ?? this.pickRandomWalkableCell();
    const goal = this.pickRandomWalkableCell(start);

    const path = this.pathFinder.findPathBFS(this.maze, start, goal);
    const walkerPath = this.walkers[index].path;
    if (!walkerPath) {
      return;
    }
    const state = walkerPath.setPath(path, (x, y) => this.cellToWorld(x, y));

    this.walkerCurrentCells[index] = start;
    this.walkerTargetCells[index] = goal;

    // Spread walkers a bit along the route to avoid complete overlap.
    const warmupSteps = Math.min(index * 18, 80);
    for (let i = 0; i < warmupSteps; i++) {
      const warm = walkerPath.update(1 / 60, (x, y) => this.cellToWorld(x, y));
      if (warm.reachedEnd) {
        break;
      }
    }

    const update = walkerPath.update(0, (x, y) => this.cellToWorld(x, y));
    this.updateWalkerMatrix(index, update.position, update.heading);
    this.setWalkerWalking(index, state.isWalking);
  }

  private pickRandomWalkableCell(except?: GridPoint): GridPoint {
    const h = this.maze.length;
    const w = this.maze[0]?.length ?? 0;

    for (let tries = 0; tries < 200; tries++) {
      const x = Math.floor(Math.random() * w);
      const y = Math.floor(Math.random() * h);
      if (this.maze[y]?.[x]) {
        continue;
      }
      if (except && except.x === x && except.y === y) {
        continue;
      }
      return { x, y };
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.maze[y][x]) {
          continue;
        }
        if (except && except.x === x && except.y === y) {
          continue;
        }
        return { x, y };
      }
    }

    return except ?? { x: 0, y: 0 };
  }

  private ensureWalkerMesh(): void {
    if (this.walkerMesh) {
      return;
    }

    const geometry = this.walkerCharacter.createGeometry();
    const material = this.walkerCharacter.createMaterial();
    this.walkerMesh = new THREE.InstancedMesh(geometry, material, this.walkerCount);
    this.scene.add(this.walkerMesh);

    this.walkerWalkData = new Float32Array(this.walkerCount);
    this.walkerWalkData.fill(1);
    const walkPhase = new Float32Array(this.walkerCount);
    for (let i = 0; i < this.walkerCount; i++) {
      walkPhase[i] = Math.random() * Math.PI * 2;
    }
    this.walkerWalkAttr = new THREE.InstancedBufferAttribute(this.walkerWalkData, 1);

    geometry.setAttribute("aWalk", this.walkerWalkAttr);
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(walkPhase, 1));
  }

  private setWalkerWalking(index: number, isWalking: boolean): void {
    if (!this.walkerWalkData || !this.walkerWalkAttr) {
      return;
    }
    this.walkerWalkData[index] = isWalking ? 1 : 0;
  }

  private updateWalkerMatrix(index: number, position: THREE.Vector3, heading: number): void {
    if (!this.walkerMesh) {
      return;
    }
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
    this.walkerScale.set(1, 1, 1);
    matrix.compose(position, quat, this.walkerScale);
    this.walkerMesh.setMatrixAt(index, matrix);
    this.walkerMesh.instanceMatrix.needsUpdate = true;
  }

  private cellToWorld(x: number, y: number): THREE.Vector3 {
    const width = this.maze[0]?.length ?? this.mazeWidth;
    const height = this.maze.length || this.mazeHeight;
    const offsetX = -(width - 1) / 2;
    const offsetZ = -(height - 1) / 2;
    return new THREE.Vector3(offsetX + x, 0, offsetZ + y);
  }

}
