import { appConstants } from '../AppConstants';
import { polygonInsideBounds, aabbOverlap, polygonsIntersectSAT } from '../sim/Geometry';
import { WorldMap3D, PlacedFootprint } from './WorldMap3D';

// private rebuild() {
//     this.root.clear();
//     this.clearCity();
//     this.placeRandomBuildings();
//     this.scene.onMapResized();
// }

export function placeRandomBuildings(map: WorldMap3D, targetCount: number) {
    if (map.size.x <= 0 || map.size.z <= 0) return;

    //const totalCells = map.width / appConstants.BuildingsScale * map.height / appConstants.BuildingsScale;
    //const targetCount = Math.max(20, Math.floor(totalCells * 0.06));
    const directionCount = 16;
    const angleStep = (Math.PI * 2) / directionCount;
    const placed: PlacedFootprint[] = [];
    const maxLength = appConstants.BuildingsMaxLength;
    const cellSize = Math.max(1, maxLength);
    const buckets = new Map<string, number[]>();

    const maxAttempts = targetCount * 40;
    let attempts = 0;

    while (placed.length < targetCount && attempts < maxAttempts) {
        attempts++;
        const x = (Math.random() * map.size.x) | 0;
        const z = (Math.random() * map.size.z) | 0;
        const model = map.buildingModels[(Math.random() * map.buildingModels.length) | 0];
        const orientationIndex = (Math.random() * directionCount) | 0;
        const orientation = orientationIndex * angleStep;

        const modelFootprint = map.scene.assetManager.getModelFootprint(model);
        const candidate = map.buildPlacementFootprint(x, z, orientation, modelFootprint);
        if (!candidate) continue;
        if (!polygonInsideBounds(candidate.polygon, 0, 0, map.size.x, map.size.z)) continue;

        const bx = Math.floor(candidate.center.x / cellSize);
        const bz = Math.floor(candidate.center.z / cellSize);

        let blocked = false;
        for (let dzCell = -1; dzCell <= 1 && !blocked; dzCell++) {
            for (let dxCell = -1; dxCell <= 1 && !blocked; dxCell++) {
                const neighbor = buckets.get(`${bx + dxCell}:${bz + dzCell}`);
                if (!neighbor) continue;

                for (const idx of neighbor) {
                    const other = placed[idx];
                    if (Math.abs(other.center.x - candidate.center.x) > maxLength) continue;
                    if (Math.abs(other.center.z - candidate.center.z) > maxLength) continue;
                    if (!aabbOverlap(candidate, other)) continue;
                    if (polygonsIntersectSAT(candidate.polygon, other.polygon)) {
                        blocked = true;
                        break;
                    }
                }
            }
        }

        if (blocked) continue;

        const mesh = map.scene.assetManager.addFastMesh(model, x, 0.0, z, orientation);
        map.buildings.push(mesh);
        const instanceKey = map.instanceKey(mesh.parent.instancedMesh, mesh.index);
        map.placedByInstance.set(instanceKey, {
            ...candidate,
            mesh: mesh.parent.instancedMesh,
            instanceId: mesh.index,
        });
        map.createNewBuildingId(instanceKey);

        const newIndex = placed.length;
        placed.push(candidate);
        const bucketKey = `${bx}:${bz}`;
        const list = buckets.get(bucketKey);
        if (list) list.push(newIndex);
        else buckets.set(bucketKey, [newIndex]);
    }
}
