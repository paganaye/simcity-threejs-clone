import * as THREE from 'three';
import { RoadNetwork } from '../RoadNetwork';
import { RoadSegment } from '../RoadSegment';
import { Signal } from '../Signal';
import { ToolController } from './ToolController';
import { ActiveTool } from './ToolTypes';

export class BulldozerToolController extends ToolController {
    private readonly pointerNdc = new THREE.Vector2();

    constructor(scene3D: ToolController['scene3D'], private readonly roadNetwork: RoadNetwork) {
        super(scene3D);
    }

    bind(_activeTool: Signal<ActiveTool>): void {
    }

    onToolChanged(_activeTool: Signal<ActiveTool>, tool: ActiveTool): void {
        if (tool === 'bulldoze') {
            this.scene3D.clearSelection();
        }
    }

    handlePointerUp(event: PointerEvent, activeTool: ActiveTool): void {
        if (activeTool !== 'bulldoze') return;

        const hitRoad = this.#pickRoadSegment(event);
        if (hitRoad) {
            this.roadNetwork.removeSegment(hitRoad);
            if (this.scene3D.uiProps.selectedCustomObject.get()?.userData?.roadSegment === hitRoad) {
                this.scene3D.clearSelection();
            }
        }
    }

    #pickRoadSegment(event: PointerEvent): RoadSegment | undefined {
        const renderDom = this.scene3D.renderDom;
        if (!renderDom || this.roadNetwork.segments.length === 0) return undefined;

        const rect = renderDom.getBoundingClientRect();
        this.pointerNdc.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        this.scene3D.raycaster.setFromCamera(this.pointerNdc, this.scene3D.camera);

        const hits = this.scene3D.raycaster.intersectObjects(this.roadNetwork.segments.map((segment) => segment.group), true);
        return hits[0]?.object.userData.roadSegment as RoadSegment | undefined;
    }
}
