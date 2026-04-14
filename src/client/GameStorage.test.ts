import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GameStorage } from './GameStorage';
import { RoadNetwork } from './roads/RoadNetwork';
import { GameScene3D } from './GameScene3D';
import { IPoint2D } from '../sim/Geometry';

vi.mock('./RoadSegment', () => {
    class MockRoadSegment {
        static created: MockRoadSegment[] = [];

        startX: number;
        startZ: number;
        endX: number;
        endZ: number;
        arcMidX?: number;
        arcMidZ?: number;

        constructor(
            public readonly sceneRoot: THREE.Object3D,
            start: IPoint2D,
            end: IPoint2D,
            private readonly iRoad?: unknown,
        ) {
            this.startX = start.x;
            this.startZ = start.z;
            this.endX = end.x;
            this.endZ = end.z;
            MockRoadSegment.created.push(this);
        }

        get angle(): number {
            return Math.atan2(-(this.endZ - this.startZ), this.endX - this.startX);
        }

        get length(): number {
            return Math.hypot(this.endX - this.startX, this.endZ - this.startZ);
        }

        getIRoad(): unknown {
            return this.iRoad;
        }

        setArc(mid: IPoint2D, end?: IPoint2D): void {
            this.arcMidX = mid.x;
            this.arcMidZ = mid.z;
            if (end) {
                this.endX = end.x;
                this.endZ = end.z;
            }
        }

        dispose(): void {
        }
    }

    return { RoadSegment: MockRoadSegment };
});

class MemoryStorage implements Storage {
    private readonly store = new Map<string, string>();

    get length(): number {
        return this.store.size;
    }

    clear(): void {
        this.store.clear();
    }

    getItem(key: string): string | null {
        return this.store.get(key) ?? null;
    }

    key(index: number): string | null {
        return [...this.store.keys()][index] ?? null;
    }

    removeItem(key: string): void {
        this.store.delete(key);
    }

    setItem(key: string, value: string): void {
        this.store.set(key, value);
    }
}

type MockRoadRecord = {
    startX: number;
    startZ: number;
    angle: number;
    length: number;
    endX: number;
    endZ: number;
    arcMidX?: number;
    arcMidZ?: number;
    getIRoad: () => unknown;
    dispose: () => void;
};

describe('GameStorage', () => {
    beforeEach(() => {
        Object.defineProperty(globalThis, 'localStorage', {
            value: new MemoryStorage(),
            configurable: true,
            writable: true,
        });
    });

    it('saves registered roads and restores them on load', () => {
        const roadType = {
            forward: {
                roadColor: 'old' as const,
                lanes: 1,
                rightKerb: 'none' as const,
                rightSidewalk: 'small' as const,
                laneWidth: 'normal' as const,
                leftKerb: 'none' as const,
                leftSidewalk: 'none' as const,
            },
            backward: {
                roadColor: 'old' as const,
                lanes: 1,
                rightKerb: 'none' as const,
                rightSidewalk: 'small' as const,
                laneWidth: 'normal' as const,
                leftKerb: 'none' as const,
                leftSidewalk: 'none' as const,
            },
            gapSize: 0,
        };

        // const straightRoad: MockRoadRecord = {
        //     startX: 1,
        //     startZ: 2,
        //     angle: Math.PI / 6,
        //     length: 7,
        //     endX: 1 + Math.cos(Math.PI / 6) * 7,
        //     endZ: 2 - Math.sin(Math.PI / 6) * 7,
        //     getIRoad: () => roadType,
        //     dispose: vi.fn(),
        // };
        // const arcRoad: MockRoadRecord = {
        //     startX: 5,
        //     startZ: 6,
        //     angle: Math.PI / 3,
        //     length: 12,
        //     endX: 14,
        //     endZ: 9,
        //     arcMidX: 10,
        //     arcMidZ: 4,
        //     getIRoad: () => roadType,
        //     dispose: vi.fn(),
        // };
        const strayRoad: MockRoadRecord = {
            startX: 8,
            startZ: 3,
            angle: Math.PI / 4,
            length: 5,
            endX: 8 + Math.cos(Math.PI / 4) * 5,
            endZ: 3 - Math.sin(Math.PI / 4) * 5,
            getIRoad: () => roadType,
            dispose: vi.fn(),
        };
        let x = new GameScene3D({ x: 40, z: 40 });
        const roadNetwork = new RoadNetwork(x);
        //roadNetwork.registerSegment(straightRoad as never);
        //roadNetwork.registerSegment(arcRoad as never);
        const sceneRoot = new THREE.Scene();
        const strayRoadNode = new THREE.Object3D();
        strayRoadNode.userData.roadSegment = strayRoad;
        sceneRoot.add(strayRoadNode);

        const clearSelection = vi.fn();
        const clearCity = vi.fn();

        const scene = {
            scene: sceneRoot,
            roadNetwork,
            worldMap3D: {
                buildings: [],
                size: { x: 40, z: 40 },
                clearCity,
                buildPlacementFootprint: vi.fn(),
                placedByInstance: new Map(),
                instanceKey: vi.fn(),
                setBuildingId: vi.fn(),
                getBuildingId: vi.fn(),
            },
            clearSelection,
            assetManager: {
                addFastMesh: vi.fn(),
                getModelFootprint: vi.fn(),
            },
            camera: new THREE.PerspectiveCamera(),
            page: undefined,
        };

        const storage = new GameStorage(scene as never, () => undefined);
        storage.saveGame('roads');

        const raw = localStorage.getItem('simcity-debug-save:roads');
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw ?? '{}') as { roads: Array<{ startX: number; arcMidX?: number }> };
        expect(parsed.roads).toHaveLength(3);
        expect(parsed.roads[1]?.arcMidX).toBe(10);
        expect(parsed.roads[2]?.startX).toBe(8);

        roadNetwork.clear();

        const loaded = storage.loadGame('roads');
        expect(loaded).toBe(true);
        expect(clearSelection).toHaveBeenCalled();
        expect(clearCity).toHaveBeenCalled();
        expect(strayRoad.dispose).toHaveBeenCalled();
        expect(roadNetwork.segments).toHaveLength(3);

        const [restoredStraight, restoredArc, restoredStray] = roadNetwork.segments as Array<{
            startX: number;
            startZ: number;
            angle: number;
            length: number;
            endX: number;
            endZ: number;
            arcMidX?: number;
            arcMidZ?: number;
        }>;

        expect(restoredStraight.startX).toBe(1);
        expect(restoredStraight.startZ).toBe(2);
        expect(restoredStraight.length).toBe(7);
        expect(restoredArc.arcMidX).toBe(10);
        expect(restoredArc.arcMidZ).toBe(4);
        expect(restoredArc.endX).toBe(14);
        expect(restoredArc.endZ).toBe(9);
        expect(restoredStray.startX).toBe(8);
        expect(restoredStray.startZ).toBe(3);
    });
});