import * as THREE from 'three';
import { render } from 'solid-js/web';
import { GameScene3D, type ILeftPointerGesture } from '../GameScene3D';
import { UIProps, GameUIComponent, UIButton } from '../GameUIComponent';
import { Page } from '../Page';
import { ActiveTool } from '../GamePage';
import { Signal } from '../Signal';
import { RoadNetwork } from '../RoadNetwork';
import { RoadSegment } from '../RoadSegment';
import { ROAD_SNAP } from '../editor/CustomGizmo';
//import { angle } from '../../utils/angle';

const MIN_ROAD_LENGTH = 0.5;

export default class RoadBuildTest extends Page {
    scene3DInstance: GameScene3D | undefined;
    uiProps: UIProps | undefined;
    readonly roadNetwork = new RoadNetwork();
    readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    readonly pointerNdc = new THREE.Vector2();
    readonly groundHit = new THREE.Vector3();
    /** Segment being drawn (not yet in network). Set on first move, committed or discarded on mouseup. */
    newRoadSegment: RoadSegment | undefined;
    /** Starting point of potential road, set on mousedown. */
    potentialRoadStart: { point: THREE.Vector3; snappedX: number; snappedZ: number } | undefined;

    #applyToolCursor(activeTool: Signal<ActiveTool>): void {
        const scene3D = this.scene3DInstance;
        const renderDom = scene3D?.renderDom;
        if (!scene3D || !renderDom) return;

        const defaultCursor = activeTool.get() === 'road' ? 'crosshair' : '';
        renderDom.style.cursor = defaultCursor;
        if (scene3D.objectGizmo) {
            scene3D.objectGizmo.getDefaultCursor = () => (activeTool.get() === 'road' ? 'crosshair' : '');
        }
        if (scene3D.roadGizmo) {
            scene3D.roadGizmo.getDefaultCursor = () => (activeTool.get() === 'road' ? 'crosshair' : '');
        }
    }

    #eventToGroundPoint(event: PointerEvent): THREE.Vector3 | undefined {
        const scene3D = this.scene3DInstance;
        const renderDom = scene3D?.renderDom;
        if (!scene3D || !renderDom) return undefined;

        const rect = renderDom.getBoundingClientRect();
        this.pointerNdc.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        scene3D.raycaster.setFromCamera(this.pointerNdc, scene3D.camera);
        if (!scene3D.raycaster.ray.intersectPlane(this.groundPlane, this.groundHit)) {
            return undefined;
        }
        return this.groundHit.clone();
    }

    #pickRoadSegment(event: PointerEvent): RoadSegment | undefined {
        const scene3D = this.scene3DInstance;
        const renderDom = scene3D?.renderDom;
        if (!scene3D || !renderDom || this.roadNetwork.segments.length === 0) return undefined;

        const rect = renderDom.getBoundingClientRect();
        this.pointerNdc.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        scene3D.raycaster.setFromCamera(this.pointerNdc, scene3D.camera);

        const hits = scene3D.raycaster.intersectObjects(this.roadNetwork.segments.map((segment) => segment.group), true);
        return hits[0]?.object.userData.roadSegment as RoadSegment | undefined;
    }

    #setupRoadInteractions(activeTool: Signal<ActiveTool>): void {
        const scene3D = this.scene3DInstance;
        if (!scene3D?.renderDom) return;

        scene3D.isCustomGizmoSelectableObject = (obj) => {
            return activeTool.get() !== 'bulldoze' && obj.userData?.selectableType === 'road';
        };

        scene3D.onLeftPointerDown = (event: PointerEvent, gesture: ILeftPointerGesture) => {
            if (event.button !== 0 || event.defaultPrevented) return;
            if (activeTool.get() !== 'road') return;
            if (gesture.consumedByGizmo) return;

            const startPoint = this.#eventToGroundPoint(event);
            if (!startPoint || !scene3D.roadGizmo) return;

            // Store potential road start point; don't create segment yet
            const snapped = scene3D.roadGizmo.defaultSnapping(startPoint, 0, ROAD_SNAP);
            this.potentialRoadStart = {
                point: startPoint,
                snappedX: snapped?.x ?? startPoint.x,
                snappedZ: snapped?.z ?? startPoint.z,
            };
        };

        scene3D.onLeftPointerMove = (event: PointerEvent) => {
            // If we have a potential road start and haven't created segment yet, check if moved far enough
            if (this.potentialRoadStart && !this.newRoadSegment && activeTool.get() === 'road') {
                const currentPoint = this.#eventToGroundPoint(event);
                if (currentPoint) {
                    const moveDistance = currentPoint.distanceTo(this.potentialRoadStart.point);
                    // Create segment if moved beyond threshold (0.1 units)
                    if (moveDistance > 0.1) {
                        // Create new road at snapped start position with initial length 0.5
                        this.newRoadSegment = new RoadSegment(
                            this.scene,
                            this.potentialRoadStart.snappedX,
                            this.potentialRoadStart.snappedZ,
                            0,      // angle
                            MIN_ROAD_LENGTH,
                            'l1'
                        );
                        scene3D.selectRoadSegment(this.newRoadSegment);
                        scene3D.roadGizmo.beginEndDrag(event);
                        scene3D.leftPointerDownConsumedByGizmo = true;
                    }
                }
            }
        };

        scene3D.onRoadSegmentResized = (seg) => {
            // Keep newRoadSegment in sync when the gizmo resizes it.
            // (seg is the same object reference — this is a no-op hook for subclasses.)
            void seg;
        };

        scene3D.onRoadDragEnded = () => {
            const seg = this.newRoadSegment;
            if (!seg) return;   // drag on an existing road, not a new one
            this.newRoadSegment = undefined;
            if (seg.length < MIN_ROAD_LENGTH) {
                seg.dispose();
                scene3D.clearSelection();
                return;
            }
            this.roadNetwork.registerSegment(seg);
        };

        scene3D.onLeftPointerUp = (event: PointerEvent, _gesture: ILeftPointerGesture) => {
            if (event.button !== 0 || event.defaultPrevented) return;

            if (activeTool.get() === 'road') {
                // Keep simple-click selection handled by GameScene3D.
                this.potentialRoadStart = undefined;
                return;
            }

            // Non-road tools: if we had a pending start but no segment, clear pending state.
            if (!this.newRoadSegment && this.potentialRoadStart) {
                this.potentialRoadStart = undefined;
            }

            // Bulldoze tool
            if (activeTool.get() !== 'bulldoze') return;
            const hitRoad = this.#pickRoadSegment(event);
            if (hitRoad) {
                this.roadNetwork.removeSegment(hitRoad);
                if (this.uiProps?.selectedCustomObject.get()?.userData?.roadSegment === hitRoad) {
                    scene3D.clearSelection();
                }
            }
        };

        scene3D.onLeftPointerCancel = () => {
            this.potentialRoadStart = undefined;
            this.newRoadSegment?.dispose();
            this.newRoadSegment = undefined;
            scene3D.clearSelection();
        };

        this.#applyToolCursor(activeTool);
    }


    async run() {

        const ToolButton = (toolProps: { tool: ActiveTool; icon: string; }) => {
            return <UIButton
                icon={toolProps.icon}
                selected={activeTool.get() === toolProps.tool}
                onclick={() => {
                    activeTool.set(toolProps.tool);
                    this.uiProps?.activeTool.set(toolProps.tool);
                    if (toolProps.tool === 'road') {
                        this.scene3DInstance?.clearSelection();
                    }
                    this.#applyToolCursor(activeTool);
                }} />;
        };


        const activeTool = new Signal<ActiveTool>('road');

        const handleUILoaded = async (uiProps: UIProps): Promise<void> => {
            this.uiProps = uiProps;
            uiProps.activeTool.set(activeTool.get());
            this.scene3DInstance = new GameScene3D(uiProps);
            await this.scene3DInstance.init(this);
            this.#setupRoadInteractions(activeTool);

            console.log("GameUI: Scene3D initialized after UI loaded.");

            uiProps.isLoading.set(false);
        };


        render(() => <GameUIComponent page={this}
            toolbar={<>
                <ToolButton tool="select" icon="select-color" />
                <ToolButton tool="bulldoze" icon="bulldozer-color" />
                <ToolButton tool="road" icon="road-color" />
            </>}
            mapSize={{ x: 40, z: 40 }} onUILoaded={handleUILoaded} />, this.appContainer);

    }


    override loop(elapsed: number): void {
        this.scene3DInstance?.drawFrame(elapsed);
    }

    override cleanup(): void {
    }


 



}


