import * as THREE from 'three';
import { type ILeftPointerGesture } from '../GameScene3D';
import { RoadNetwork } from '../RoadNetwork';
import { RoadSegment } from '../RoadSegment';
import { Signal } from '../Signal';
import { ROAD_SNAP } from '../editor/CustomGizmo';
import { ToolController } from './ToolController';
import { ActiveTool } from './ToolTypes';
import { BulldozerToolController } from './BulldozerToolController';

const MIN_ROAD_LENGTH = 0.5;

export class RoadToolController extends ToolController {
    private readonly roadNetwork = new RoadNetwork();
    private readonly bulldozerToolController = new BulldozerToolController(this.scene3D, this.roadNetwork);
    private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private readonly pointerNdc = new THREE.Vector2();
    private readonly groundHit = new THREE.Vector3();
    private newRoadSegment: RoadSegment | undefined;
    private potentialRoadStart: { point: THREE.Vector3; snappedX: number; snappedZ: number } | undefined;

    bind(activeTool: Signal<ActiveTool>): void {
        this.scene3D.isCustomGizmoSelectableObject = (obj) => {
            return activeTool.get() !== 'bulldoze' && obj.userData?.selectableType === 'road';
        };

        this.scene3D.onLeftPointerDown = (event: PointerEvent, gesture: ILeftPointerGesture) => {
            if (event.button !== 0 || event.defaultPrevented) return;
            if (activeTool.get() !== 'road') return;
            if (gesture.consumedByGizmo) return;

            const startPoint = this.#eventToGroundPoint(event);
            if (!startPoint || !this.scene3D.roadGizmo) return;

            const snapped = this.scene3D.roadGizmo.defaultSnapping(startPoint, 0, ROAD_SNAP);
            this.potentialRoadStart = {
                point: startPoint,
                snappedX: snapped?.x ?? startPoint.x,
                snappedZ: snapped?.z ?? startPoint.z,
            };
        };

        this.scene3D.onLeftPointerMove = (event: PointerEvent) => {
            if (this.potentialRoadStart && !this.newRoadSegment && activeTool.get() === 'road') {
                const currentPoint = this.#eventToGroundPoint(event);
                if (currentPoint) {
                    const moveDistance = currentPoint.distanceTo(this.potentialRoadStart.point);
                    if (moveDistance > 0.1) {
                        this.newRoadSegment = new RoadSegment(
                            this.scene3D.scene,
                            this.potentialRoadStart.snappedX,
                            this.potentialRoadStart.snappedZ,
                            0,
                            MIN_ROAD_LENGTH,
                            'l1'
                        );
                        this.scene3D.selectRoadSegment(this.newRoadSegment);
                        this.scene3D.roadGizmo.beginEndDrag(event);
                        this.scene3D.leftPointerDownConsumedByGizmo = true;
                    }
                }
            }
        };

        this.scene3D.onRoadSegmentResized = (seg) => {
            void seg;
        };

        this.scene3D.onRoadDragEnded = () => {
            const seg = this.newRoadSegment;
            if (!seg) return;
            this.newRoadSegment = undefined;
            if (seg.length < MIN_ROAD_LENGTH) {
                seg.dispose();
                this.scene3D.clearSelection();
                return;
            }
            this.roadNetwork.registerSegment(seg);
        };

        this.scene3D.onLeftPointerUp = (event: PointerEvent) => {
            if (event.button !== 0 || event.defaultPrevented) return;

            if (activeTool.get() === 'road') {
                this.potentialRoadStart = undefined;
                return;
            }

            if (!this.newRoadSegment && this.potentialRoadStart) {
                this.potentialRoadStart = undefined;
            }

            this.bulldozerToolController.handlePointerUp(event, activeTool.get());
        };

        this.scene3D.onLeftPointerCancel = () => {
            this.potentialRoadStart = undefined;
            this.newRoadSegment?.dispose();
            this.newRoadSegment = undefined;
            this.scene3D.clearSelection();
        };

        this.#applyToolCursor(activeTool);
        this.bulldozerToolController.bind(activeTool);
    }

    onToolChanged(activeTool: Signal<ActiveTool>, tool: ActiveTool): void {
        if (tool === 'road') {
            this.scene3D.clearSelection();
        }
        this.#applyToolCursor(activeTool);
        this.bulldozerToolController.onToolChanged(activeTool, tool);
    }

    #applyToolCursor(activeTool: Signal<ActiveTool>): void {
        const renderDom = this.scene3D.renderDom;
        if (!renderDom) return;

        const defaultCursor = activeTool.get() === 'road' ? 'crosshair' : '';
        renderDom.style.cursor = defaultCursor;
        if (this.scene3D.objectGizmo) {
            this.scene3D.objectGizmo.getDefaultCursor = () => (activeTool.get() === 'road' ? 'crosshair' : '');
        }
        if (this.scene3D.roadGizmo) {
            this.scene3D.roadGizmo.getDefaultCursor = () => (activeTool.get() === 'road' ? 'crosshair' : '');
        }
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
