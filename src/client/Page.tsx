import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'lil-gui';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { App } from './App';
import { CameraRotateGizmo } from './CameraRotateGizmo';

const MIDDLE_PAN_SMOOTHING = 20;
const MIDDLE_PAN_EPSILON_SQ = 0.0001;

export abstract class Page {
    app!: App<any>;
    pageName!: any;

    width!: number;
    height!: number;
    appContainer!: HTMLElement;
    scene!: THREE.Scene;
    renderer!: THREE.WebGLRenderer;
    camera!: THREE.PerspectiveCamera;

    controls?: OrbitControls;
    cameraRotateGizmo?: CameraRotateGizmo;
    gui?: GUI;
    statsFPS?: Stats;
    statsMS?: any;
    statsMB?: any;
    isMiddlePointerDown = false;
    readonly middlePanTargetGoal = new THREE.Vector3();
    readonly middlePanCameraGoal = new THREE.Vector3();
    middlePanAnimating = false;

    readonly options = {
        addGUI: true
    } as const

    abstract run(): Promise<void> | void;

    async start(app: App) {
        this.app = app;
        this.pageName = app.pageName;
        this.setAppRootElement();
        this.createRenderer();
        this.createScene()
        this.createLights()
        this.createCamera()
        this.createAxisHelper()
        this.createMouseControls()
        this.addStats();
        if (this.options.addGUI) this.addGUI();
        this.setupResizeObserver()
        this.setupLoop()

        this.run();
    }

    protected setAppRootElement() {
        this.appContainer = document.getElementById('app-container') || document.body;
    }

    protected createRenderer() {
        this.width = this.appContainer.clientWidth;
        this.height = this.appContainer.clientHeight;
        this.renderer = new THREE.WebGLRenderer({ stencil: true, antialias: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        while (this.appContainer.firstChild) {
            this.appContainer.removeChild(this.appContainer.firstChild);
        }
        this.appContainer.appendChild(this.renderer.domElement);
    }

    protected createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x101010);
    }

    protected createCamera() {
        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        this.camera.position.set(60, 220, 120);
        // we want took at the center of the map, but since we don't know the size yet, we'll update this in onCityChanged
    }

    protected createLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(10, 20, 15);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }

    protected createAxisHelper() {
        const axesHelper = new THREE.AxesHelper(5);
        this.scene.add(axesHelper);
    }

    protected createMouseControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.zoomSpeed = 2.5;
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.ROTATE,
            RIGHT: undefined,
        };

        this.cameraRotateGizmo = new CameraRotateGizmo(this.scene);

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const hitPoint = new THREE.Vector3();
        const panDelta = new THREE.Vector3();
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        this.renderer.domElement.addEventListener('pointerdown', (event) => {
            if (event.button !== 1 || !this.controls) return;
            this.isMiddlePointerDown = true;

            const rect = this.renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(pointer, this.camera);

            // Prefer the exact 3D point under cursor (including Y).
            const sceneHits = raycaster.intersectObjects(this.scene.children, true);
            if (sceneHits.length > 0) {
                hitPoint.copy(sceneHits[0].point);
            } else if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
                return;
            }

            // Move camera and target by the same delta to keep view direction unchanged.
            panDelta.copy(hitPoint).sub(this.controls.target);
            this.middlePanTargetGoal.copy(this.controls.target).add(panDelta);
            this.middlePanCameraGoal.copy(this.camera.position).add(panDelta);
            this.middlePanAnimating = true;

            this.cameraRotateGizmo?.setTarget(this.middlePanTargetGoal);
        });

        this.renderer.domElement.addEventListener('pointerup', (event) => {
            if (event.button !== 1) return;
            this.isMiddlePointerDown = false;
            this.cameraRotateGizmo?.hide();
        });

        this.renderer.domElement.addEventListener('pointercancel', () => {
            this.isMiddlePointerDown = false;
            this.cameraRotateGizmo?.hide();
        });
    }

    #updateMiddlePan(deltaSeconds: number) {
        if (!this.controls || !this.middlePanAnimating) return;

        const alpha = 1 - Math.exp(-MIDDLE_PAN_SMOOTHING * deltaSeconds);
        this.controls.target.lerp(this.middlePanTargetGoal, alpha);
        this.camera.position.lerp(this.middlePanCameraGoal, alpha);

        const targetDone = this.controls.target.distanceToSquared(this.middlePanTargetGoal) <= MIDDLE_PAN_EPSILON_SQ;
        const cameraDone = this.camera.position.distanceToSquared(this.middlePanCameraGoal) <= MIDDLE_PAN_EPSILON_SQ;
        if (targetDone && cameraDone) {
            this.controls.target.copy(this.middlePanTargetGoal);
            this.camera.position.copy(this.middlePanCameraGoal);
            this.middlePanAnimating = false;
        }
    }

    protected addStats() {
        this.statsFPS = new Stats();
        this.statsFPS.showPanel(0);
        this.statsFPS.dom.style.cssText = 'position:absolute;bottom:0;right:0px;z-index:100;';
        document.body.appendChild(this.statsFPS.dom);

        const statsMS = new Stats();
        statsMS.showPanel(1);
        statsMS.dom.style.cssText = 'position:absolute;bottom:0;right:80px;z-index:100;';
        document.body.appendChild(statsMS.dom);

        const statsMB = new Stats();
        statsMB.showPanel(2);
        statsMB.dom.style.cssText = 'position:absolute;bottom:0;right:160px;z-index:100;';
        document.body.appendChild(statsMB.dom);

        const allStatsPanels = [this.statsFPS.dom, statsMS.dom, statsMB.dom];
        if (this.gui) {
            const guiParams = {
                showStats: true,
            };
            this.gui.add(guiParams, 'showStats').name('Show Stats').onChange((value: boolean) => {
                allStatsPanels.forEach(panel => panel.style.display = value ? 'block' : 'none');
            });
        }
    }

    protected addGUI() {
        const oldGui = document.querySelector('.lil-gui');
        if (oldGui) oldGui.remove(); // Remove previous GUI

        this.gui = new GUI();
        const guiParams = {
            //            showStats: true,
            currentScene: this.pageName
        };

        this.gui.add(guiParams, 'currentScene', Object.keys(this.app.pages))
            .name('Select Scene')
            .onChange((newSceneKey: string) => {
                localStorage.setItem(App.LOCAL_STORAGE_PAGE_KEY, newSceneKey as string);
                this.renderer.setAnimationLoop(null);
                try {
                    this.cleanup()
                } catch (e: any) {

                }
                window.location.reload(); // Simplest way to ensure a fresh start
            });
    }

    protected setupResizeObserver() {
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                this.camera.aspect = width / height;  // Update aspect ratio
                this.camera.updateProjectionMatrix(); // Apply changes
                this.renderer.setSize(width, height);
            }
        });
        resizeObserver.observe(this.appContainer);
    }

    protected setupLoop() {
        const clock = new THREE.Clock();

        this.renderer.setAnimationLoop(() => {
            this.statsFPS?.begin();
            this.statsMS?.begin();
            this.statsMB?.begin();

            const deltaSeconds = clock.getDelta();
            const elapsedTime = clock.elapsedTime;
            this.loop(elapsedTime);
            this.#updateMiddlePan(deltaSeconds);
            this.cameraRotateGizmo?.update(deltaSeconds, this.camera);
            this.controls?.update();
            this.renderer.render(this.scene, this.camera);
            this.statsFPS?.end();
            this.statsMS?.end();
            this.statsMB?.end();
        });

    }



    cleanup() {
        this.cameraRotateGizmo?.dispose();
        this.cameraRotateGizmo = undefined;
    }

    loop(_elapsed: number) {

    }
}
