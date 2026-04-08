import * as THREE from 'three';
import { type ILeftPointerGesture } from '../GameScene3D';
import { RoadSegment } from '../RoadSegment';
import { ROAD_SNAP } from '../editor/CustomGizmo';
import { ToolController } from './ToolController';
import { ActiveTool } from './ToolTypes';

const MIN_ROAD_LENGTH = 0.5;

export class RoadToolController extends ToolController {
    private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private readonly pointerNdc = new THREE.Vector2();
    private readonly groundHit = new THREE.Vector3();
    private newRoadSegment: RoadSegment | undefined;
    private potentialRoadStart: { point: THREE.Vector3; snappedX: number; snappedZ: number } | undefined;

    onToolChanged(tool: ActiveTool): void {
        if (tool === 'road') {
            this.scene3D.clearSelection();
        }
        const isRoad = tool === 'road';
        const cursor = isRoad ? 'crosshair' : '';
        if (this.scene3D.renderDom) this.scene3D.renderDom.style.cursor = cursor;
        if (this.scene3D.objectGizmo) this.scene3D.objectGizmo.getDefaultCursor = () => cursor;
        if (this.scene3D.roadGizmo) this.scene3D.roadGizmo.getDefaultCursor = () => cursor;
    }

    override onPointerDown(event: PointerEvent, gesture: ILeftPointerGesture): void {
        if (event.button !== 0 || event.defaultPrevented) return;
        if (gesture.consumedByGizmo) return;

        const startPoint = this.#eventToGroundPoint(event);
        if (!startPoint || !this.scene3D.roadGizmo) return;

        const snapped = this.scene3D.roadGizmo.defaultSnapping(startPoint, 0, ROAD_SNAP);
        this.potentialRoadStart = {
            point: startPoint,
            snappedX: snapped?.x ?? startPoint.x,
            snappedZ: snapped?.z ?? startPoint.z,
        };
    }

    override onPointerMove(event: PointerEvent, _gesture: ILeftPointerGesture): void {
        if (!this.potentialRoadStart || this.newRoadSegment) return;

        const currentPoint = this.#eventToGroundPoint(event);
        if (!currentPoint) return;

        if (currentPoint.distanceTo(this.potentialRoadStart.point) > 0.1) {
            this.newRoadSegment = new RoadSegment(
                this.scene3D.scene,
                this.potentialRoadStart.snappedX,
                this.potentialRoadStart.snappedZ,
                0,
                MIN_ROAD_LENGTH,
                this.scene3D.lastSelectedRoad,
            );
            this.scene3D.selectRoadSegment(this.newRoadSegment);
            this.scene3D.roadGizmo.beginEndDrag(event);
            this.scene3D.leftPointerDownConsumedByGizmo = true;
        }
    }

    override onPointerUp(_event: PointerEvent, _gesture: ILeftPointerGesture): void {
        this.potentialRoadStart = undefined;
    }

    override onPointerCancel(): void {
        this.potentialRoadStart = undefined;
        this.newRoadSegment?.dispose();
        this.newRoadSegment = undefined;
        this.scene3D.clearSelection();
    }

    onRoadSegmentResized(_seg: RoadSegment): void {
        // Hook for externally tracking resizes if needed.
    }

    onRoadDragEnded(): void {
        const seg = this.newRoadSegment;
        if (!seg) return;
        this.newRoadSegment = undefined;
        if (seg.length < MIN_ROAD_LENGTH) {
            seg.dispose();
            this.scene3D.clearSelection();
            return;
        }
        //this.scene3D.roadNetwork.registerSegment(seg);
    }

    #eventToGroundPoint(event: PointerEvent): THREE.Vector3 | undefined {
        const renderDom = this.scene3D.renderDom;
        if (!renderDom) return undefined;

        const rect = renderDom.getBoundingClientRect();
        this.pointerNdc.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        this.scene3D.raycaster.setFromCamera(this.pointerNdc, this.scene3D.camera);
        if (!this.scene3D.raycaster.ray.intersectPlane(this.groundPlane, this.groundHit)) {
            return undefined;
        }
        return this.groundHit.clone();
    }
}
