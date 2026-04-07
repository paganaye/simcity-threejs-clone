import * as THREE from 'three';
import { render } from 'solid-js/web';
import { GameScene3D, type ILeftPointerGesture } from '../GameScene3D';
import { UIProps, GameUIComponent, UIButton } from '../GameUIComponent';
import { Page } from '../Page';
import { ActiveTool } from '../GamePage';
import { Signal } from '../Signal';
import { RoadNetwork } from '../RoadNetwork';
import { RoadSegment } from '../RoadSegment';
//import { angle } from '../../utils/angle';

export default class RoadBuildTest extends Page {
    scene3DInstance: GameScene3D | undefined;
    uiProps: UIProps | undefined;
    readonly roadNetwork = new RoadNetwork();
    selectedRoadSegment: RoadSegment | undefined;
    readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    readonly pointerNdc = new THREE.Vector2();
    readonly groundHit = new THREE.Vector3();
    readonly defaultRoadLength = 4;
    roadPreviewSegment: RoadSegment | undefined;
    roadDrawStartPoint: THREE.Vector3 | undefined;
    isRoadDrawing = false;

    #applyToolCursor(activeTool: Signal<ActiveTool>): void {
        const scene3D = this.scene3DInstance;
        const renderDom = scene3D?.renderDom;
        if (!scene3D || !renderDom) return;

        const defaultCursor = activeTool.get() === 'road' ? 'crosshair' : '';
        renderDom.style.cursor = defaultCursor;
        if (scene3D.customGizmo) {
            scene3D.customGizmo.getDefaultCursor = () => (activeTool.get() === 'road' ? 'crosshair' : '');
        }
    }

    #selectRoadSegment(segment: RoadSegment | undefined): void {
        this.selectedRoadSegment = segment;
        this.uiProps?.selectedCustomObject.set(segment?.group);
        this.uiProps?.selectedInstance.set(undefined);

        if (!segment) {
            this.scene3DInstance?.customGizmo?.clearSelection();
            return;
        }

        this.scene3DInstance?.customGizmo?.setRoadSelection({
            startX: segment.startX,
            startZ: segment.startZ,
            endX: segment.endX,
            endZ: segment.endZ,
            angle: segment.angle,
            length: segment.length,
        });
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

    #stopRoadDrawing(clearPreview = true): void {
        this.isRoadDrawing = false;
        this.roadDrawStartPoint = undefined;
        this.controls && (this.controls.enabled = true);
        if (clearPreview && this.roadPreviewSegment) {
            this.roadPreviewSegment.dispose();
            this.roadPreviewSegment = undefined;
        }
    }

    #setupRoadInteractions(activeTool: Signal<ActiveTool>): void {
        const scene3D = this.scene3DInstance;
        if (!scene3D?.renderDom) return;

        scene3D.isCustomGizmoSelectableObject = (obj) => {
            return activeTool.get() !== 'bulldoze' && obj.userData?.selectableType === 'road';
        };

        scene3D.onCustomGizmoObjectSelected = (obj) => {
            const segment = obj.userData?.roadSegment as RoadSegment | undefined;
            if (segment) {
                this.#selectRoadSegment(segment);
            }
        };

        if (scene3D.customGizmo) {
            scene3D.customGizmo.getSelectedRoadHandle = () => {
                const segment = this.selectedRoadSegment;
                if (!segment) return undefined;
                return {
                    startX: segment.startX,
                    startZ: segment.startZ,
                    endX: segment.endX,
                    endZ: segment.endZ,
                    angle: segment.angle,
                    length: segment.length,
                };
            };
            scene3D.customGizmo.onRoadMoved = (x, z, angle) => {
                this.selectedRoadSegment?.moveTo(x, z, angle);
            };
            scene3D.customGizmo.onRoadResized = (newLength) => {
                this.selectedRoadSegment?.resize(newLength);
            };
            scene3D.customGizmo.onDeselect = () => {
                this.selectedRoadSegment = undefined;
                this.uiProps?.selectedCustomObject.set(undefined);
            };
        }

        scene3D.onLeftPointerDown = (event: PointerEvent, gesture: ILeftPointerGesture) => {
            if (event.button !== 0 || event.defaultPrevented) return;
            if (activeTool.get() !== 'road') return;
            if (gesture.consumedByGizmo) return;

            const hitRoad = this.#pickRoadSegment(event);
            if (hitRoad) return;

            const startPoint = this.#eventToGroundPoint(event);
            if (!startPoint || !scene3D.customGizmo) return;

            const snappedStart = scene3D.customGizmo.defaultSnapping(startPoint, 0);
            const startX = snappedStart?.x ?? startPoint.x;
            const startZ = snappedStart?.z ?? startPoint.z;

            this.#stopRoadDrawing(true);
            this.controls && (this.controls.enabled = false);
            this.isRoadDrawing = true;
            this.roadDrawStartPoint = new THREE.Vector3(startX, 0, startZ);
            this.roadPreviewSegment = new RoadSegment(this.scene, startX, startZ, 0, 0.5, 'l1');
        };

        scene3D.onLeftPointerMove = (event: PointerEvent, _gesture: ILeftPointerGesture) => {
            if (!this.isRoadDrawing || !this.roadDrawStartPoint || !this.roadPreviewSegment) return;
            if (!scene3D.customGizmo) return;

            const endPoint = this.#eventToGroundPoint(event);
            if (!endPoint) return;

            const dragDx = endPoint.x - this.roadDrawStartPoint.x;
            const dragDz = endPoint.z - this.roadDrawStartPoint.z;
            const dragLength = Math.hypot(dragDx, dragDz);
            if (dragLength < 0.01) return;

            const angle = Math.atan2(-dragDz, dragDx);
            const snappedStart = scene3D.customGizmo.defaultSnapping(this.roadDrawStartPoint, angle);
            const length = Math.max(0.5, Math.round(dragLength));
            this.roadPreviewSegment.moveTo(
                snappedStart?.x ?? this.roadDrawStartPoint.x,
                snappedStart?.z ?? this.roadDrawStartPoint.z,
                snappedStart?.angle ?? angle,
            );
            this.roadPreviewSegment.resize(length);
        };

        scene3D.onLeftPointerUp = (event: PointerEvent, gesture: ILeftPointerGesture) => {
            if (event.button !== 0 || event.defaultPrevented) return;

            const tool = activeTool.get();
            const hitRoad = this.#pickRoadSegment(event);

            if (tool === 'bulldoze') {
                if (hitRoad) {
                    this.roadNetwork.removeSegment(hitRoad);
                    if (this.selectedRoadSegment === hitRoad) {
                        this.#selectRoadSegment(undefined);
                    }
                }
                return;
            }

            if (tool !== 'road') return;
            if (!this.isRoadDrawing || !this.roadPreviewSegment) return;

            const preview = this.roadPreviewSegment;
            const shouldCommit = !hitRoad && !gesture.consumedByGizmo && gesture.moved && preview.length >= 0.5;
            this.#stopRoadDrawing(false);

            if (!shouldCommit) {
                preview.dispose();
                this.roadPreviewSegment = undefined;
                return;
            }

            const segment = this.roadNetwork.addSegment(
                this.scene,
                preview.startX,
                preview.startZ,
                preview.angle,
                preview.length,
                preview.roadType,
            );
            preview.dispose();
            this.roadPreviewSegment = undefined;
            this.#selectRoadSegment(segment);
        };

        scene3D.onLeftPointerCancel = () => {
            this.#stopRoadDrawing(true);
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


    // async run() {
    //     const cubeGeometry = new THREE.BoxGeometry();
    //     const material = new THREE.MeshStandardMaterial();
    //     const cube = new THREE.Mesh(cubeGeometry, material);
    //     this.scene.add(cube);


    //     let radius = 1;

    //     //      const builder =
    //     let builder = new RoadBuilder({ x: -1, y: 0.015, z: 4, angle: 0 }, this.scene);
    //     builder.addStraightRoad(1, 'none', 'l1');
    //     builder.addTurningRoad(angle(30), radius, 'none', 'l1');
    //     builder.addStraightRoad(2, 'none', 'l2');
    //     builder.addTurningRoad(angle(-30), radius, 'none', 'l2');
    //     builder.addStraightRoad(1, 'none', 'l3');
    //     builder.addTurningRoad(angle(90), radius, 'none', 'l3');
    //     builder.addStraightRoad(4.2, 'l3', 'l3');
    //     builder.addTurningRoad(angle(90), radius, 'l4');
    //     builder.addStraightRoad(4.2, 'l5');
    //     builder.addTurningRoad(angle(90), radius, 'l5');
    //     builder.addStraightRoad(3.6, 'l6');
    //     builder.addTurningRoad(angle(-30), radius, 'l6');
    //     builder.addStraightRoad(1, 'l1', 'l1');
    //     builder.addTurningRoad(angle(120), radius, 'l1', 'l1');
    //     builder.addStraightRoad(0.25, 'none', 'l1');

    // }






}


