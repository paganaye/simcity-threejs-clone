import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'lil-gui';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { App } from './App';

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
    gui?: GUI;
    statsFPS?: Stats;
    statsMS?: any;
    statsMB?: any;

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
        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 200);
        this.camera.position.set(-2, 5, 5);
        this.camera.lookAt(10, 0, 5);
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

            const elapsedTime = clock.getElapsedTime();
            this.loop(elapsedTime);
            this.controls?.update();
            this.renderer.render(this.scene, this.camera);
            this.statsFPS?.end();
            this.statsMS?.end();
            this.statsMB?.end();
        });

    }



    cleanup() {
        // nothing here but can be overriden
    }

    loop(_elapsed: number) {

    }
}
