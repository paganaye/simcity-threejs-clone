import * as THREE from 'three';
import { type ILeftPointerGesture } from '../GameScene3D';
import { RoadSegment } from '../RoadSegment';
import { ToolController } from './ToolController';
import { ActiveTool } from './ToolTypes';

type PickedDeletableObject =
    | { type: 'road'; roadSegment: RoadSegment }
    | { type: 'building'; mesh: THREE.InstancedMesh; instanceId: number };

export class BulldozerToolController extends ToolController {
    private readonly pointerNdc = new THREE.Vector2();

    onToolChanged(tool: ActiveTool): void {
        if (tool === 'bulldoze') {
            this.scene3D.clearSelection();
        }
    }

    override onPointerUp(event: PointerEvent, gesture: ILeftPointerGesture): void {
        if (event.button !== 0 || gesture.moved) return;

        const picked = this.#pickDeletableObject(event);
        if (!picked) return;

        if (picked.type === 'road') {
            this.scene3D.roadNetwork.removeSegment(picked.roadSegment);
            if (this.scene3D.selectedCustomObject.get()?.userData?.roadSegment === picked.roadSegment) {
                this.scene3D.clearSelection();
            }
            return;
        }

        if (this.scene3D.worldMap3D.removeBuilding(picked.mesh, picked.instanceId)) {
            const selected = this.scene3D.selectedInstance.get();
            if (selected?.mesh === picked.mesh && selected.instanceId === picked.instanceId) {
                this.scene3D.clearSelection();
            }
        }
    }

    #pickDeletableObject(event: PointerEvent): PickedDeletableObject | undefined {
        const renderDom = this.scene3D.renderDom;
        if (!renderDom) return undefined;

        const rect = renderDom.getBoundingClientRect();
        this.pointerNdc.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        this.scene3D.raycaster.setFromCamera(this.pointerNdc, this.scene3D.camera);

        const hits = this.scene3D.raycaster.intersectObjects(this.scene3D.scene.children, true);
        for (const hit of hits) {
            const roadSegment = hit.object.userData?.roadSegment as RoadSegment | undefined;
            if (roadSegment) {
                return { type: 'road', roadSegment };
            }

            const selectableType = hit.object.userData?.selectableType as string | undefined;
            if (selectableType === 'building' && hit.instanceId != null) {
                return {
                    type: 'building',
                    mesh: hit.object as THREE.InstancedMesh,
                    instanceId: hit.instanceId,
                };
            }
        }

        return undefined;
    }
}
