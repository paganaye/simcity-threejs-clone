import * as THREE from 'three';
import { type ILeftPointerGesture } from '../GameScene3D';
import { RoadSegment } from '../RoadSegment';
import { ToolController } from './ToolController';
import { ActiveTool } from './ToolTypes';

export class BulldozerToolController extends ToolController {
    private readonly pointerNdc = new THREE.Vector2();

    onToolChanged(tool: ActiveTool): void {
        if (tool === 'bulldoze') {
            this.scene3D.clearSelection();
        }
    }

    override onPointerUp(event: PointerEvent, gesture: ILeftPointerGesture): void {
        if (event.button !== 0 || gesture.moved) return;

        const hitRoad = this.#pickRoadSegment(event);
        if (hitRoad) {
            this.scene3D.roadNetwork.removeSegment(hitRoad);
            if (this.scene3D.uiProps.selectedCustomObject.get()?.userData?.roadSegment === hitRoad) {
                this.scene3D.clearSelection();
            }
        }
    }

    #pickRoadSegment(event: PointerEvent): RoadSegment | undefined {
        const renderDom = this.scene3D.renderDom;
        if (!renderDom || this.scene3D.roadNetwork.segments.length === 0) return undefined;

        const rect = renderDom.getBoundingClientRect();
        this.pointerNdc.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        this.scene3D.raycaster.setFromCamera(this.pointerNdc, this.scene3D.camera);

        const hits = this.scene3D.raycaster.intersectObjects(
            this.scene3D.roadNetwork.segments.map((s) => s.group),
            true,
        );
        return hits[0]?.object.userData.roadSegment as RoadSegment | undefined;
    }
}
