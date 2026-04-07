import * as THREE from "three";
import { Page } from "../Page";

type RotationOrder = "XYZ" | "XZY" | "YXZ" | "YZX" | "ZXY" | "ZYX";
type WizardStep = 0 | 1 | 2 | 3 | 4;

export default class QuaternionTest extends Page {
  private eulerObject?: THREE.Mesh;
  private quaternionObject?: THREE.Mesh;
  private infoPanel?: HTMLDivElement;
  private infoText?: HTMLDivElement;
  private prevButton?: HTMLButtonElement;
  private nextButton?: HTMLButtonElement;

  private readonly params = {
    order: "YXZ" as RotationOrder,
    yawDeg: 30,
    pitchDeg: 20,
    rollDeg: 0,
    gimbalPitchDeg: 89,
    gimbalYawDeg: 35,
    gimbalRollDeg: 35,
    axisX: 0.35,
    axisY: 1,
    axisZ: 0.2,
    angleDeg: 70,
    reset: () => this.resetDemo(),
  };

  private currentStep: WizardStep = 0;
  private readonly eulerState = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly tmpVector = new THREE.Vector3();
  private readonly tmpEuler = new THREE.Euler(0, 0, 0, "YXZ");
  private axisArrow?: THREE.ArrowHelper;

  private readonly hiddenByStep = new Map<number, number[]>();

  async run() {
    this.scene.background = new THREE.Color(0x0f1622);

    this.camera.position.set(8, 6, 10);
    if (this.cameraControls) {
      this.cameraControls.target.set(0, 1.2, 0);
      this.cameraControls.update();
    }

    this.createDemoScene();
    this.createWizardPanel();
    this.setupGui();
    this.renderCurrentStep();
    this.resetDemo();
  }

  override loop(_elapsed: number): void {
    this.updateTransforms();
    this.updatePanel();
  }

  override cleanup(): void {
    if (this.axisArrow) {
      this.scene.remove(this.axisArrow);
      this.axisArrow = undefined;
    }
    this.infoPanel?.remove();
    this.infoPanel = undefined;
    this.infoText = undefined;
    this.prevButton = undefined;
    this.nextButton = undefined;
    this.hiddenByStep.clear();
  }

  private createDemoScene(): void {
    const grid = new THREE.GridHelper(24, 24, 0x557799, 0x334455);
    this.scene.add(grid);

    const dieGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);

    this.eulerObject = new THREE.Mesh(dieGeometry, this.createDieMaterials(0x50d7ff));
    this.eulerObject.position.set(-3.2, 0.75, 0);
    this.eulerObject.add(new THREE.AxesHelper(1.6));
    this.scene.add(this.eulerObject);

    this.quaternionObject = new THREE.Mesh(dieGeometry, this.createDieMaterials(0xff9f43));
    this.quaternionObject.position.set(3.2, 0.75, 0);
    this.quaternionObject.add(new THREE.AxesHelper(1.6));
    this.scene.add(this.quaternionObject);

    this.axisArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(3.2, 0.75, 0),
      3.5,
      0xffffff,
      0.4,
      0.2
    );
    this.axisArrow.visible = false;
    this.scene.add(this.axisArrow);
  }

  private createWizardPanel(): void {
    const panel = document.createElement("div");
    panel.style.position = "absolute";
    panel.style.left = "12px";
    panel.style.top = "12px";
    panel.style.maxWidth = "520px";
    panel.style.padding = "12px";
    panel.style.border = "1px solid rgba(255,255,255,0.14)";
    panel.style.background = "rgba(9, 15, 28, 0.82)";
    panel.style.backdropFilter = "blur(4px)";
    panel.style.color = "#eef5ff";
    panel.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    panel.style.fontSize = "12px";
    panel.style.lineHeight = "1.5";
    panel.style.whiteSpace = "pre-wrap";

    const title = document.createElement("div");
    title.textContent = "Quaternion Tutorial";
    title.style.fontWeight = "700";
    title.style.marginBottom = "8px";
    panel.appendChild(title);

    const text = document.createElement("div");
    text.style.marginBottom = "10px";
    panel.appendChild(text);

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";

    const prev = document.createElement("button");
    prev.textContent = "Precedent";
    prev.style.padding = "6px 10px";
    prev.style.cursor = "pointer";
    prev.onclick = () => this.goToStep((this.currentStep - 1) as WizardStep);

    const next = document.createElement("button");
    next.textContent = "Suivant";
    next.style.padding = "6px 10px";
    next.style.cursor = "pointer";
    next.onclick = () => this.goToStep((this.currentStep + 1) as WizardStep);

    row.appendChild(prev);
    row.appendChild(next);
    panel.appendChild(row);

    this.appContainer.appendChild(panel);
    this.infoPanel = panel;
    this.infoText = text;
    this.prevButton = prev;
    this.nextButton = next;
  }

  private createDieMaterials(tint: number): THREE.MeshStandardMaterial[] {
    // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
    const labels = ["X+", "X-", "Y+", "Y-", "Z+", "Z-"];
    const labelColors = ["#e74c3c", "#c0392b", "#2ecc71", "#27ae60", "#3498db", "#2980b9"];

    return labels.map((label, i) => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return new THREE.MeshStandardMaterial({ color: tint });
      }

      ctx.fillStyle = "#f8fbff";
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = "#1b2433";
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, 246, 246);
      ctx.fillStyle = labelColors[i];
      ctx.font = "bold 110px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 128, 136);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ color: tint, map: texture, roughness: 0.35, metalness: 0.1 });
    });
  }

  private setupGui(): void {
    if (!this.gui) {
      return;
    }

    const folder = this.gui.addFolder("Wizard controls");
    const orderChoices: Record<string, RotationOrder> = {
      "yaw pitch roll (YXZ)": "YXZ",
      "pitch yaw roll (XYZ)": "XYZ",
      "pitch roll yaw (XZY)": "XZY",
      "yaw roll pitch (YZX)": "YZX",
      "roll pitch yaw (ZXY)": "ZXY",
      "roll yaw pitch (ZYX)": "ZYX",
    };
    const c0 = folder.add(this.params, "order", orderChoices).name("Ordre Euler");
    const c1 = folder.add(this.params, "yawDeg", -180, 180, 1).name("Yaw (deg)");
    const c2 = folder.add(this.params, "pitchDeg", -89, 89, 1).name("Pitch (deg)");
    const c3 = folder.add(this.params, "rollDeg", -180, 180, 1).name("Roll (deg)");
    const c4 = folder.add(this.params, "gimbalPitchDeg", -90, 90, 0.1).name("Pitch lock (deg)");
    const c5 = folder.add(this.params, "gimbalYawDeg", -180, 180, 1).name("Yaw command");
    const c6 = folder.add(this.params, "gimbalRollDeg", -180, 180, 1).name("Roll command");
    const c7 = folder.add(this.params, "axisX", -1, 1, 0.01).name("Axis X");
    const c8 = folder.add(this.params, "axisY", -1, 1, 0.01).name("Axis Y");
    const c9 = folder.add(this.params, "axisZ", -1, 1, 0.01).name("Axis Z");
    const c10 = folder.add(this.params, "angleDeg", -180, 180, 1).name("Angle (deg)");

    folder.add(this.params, "reset").name("Reset step");

    this.hiddenByStep.set(0, [0, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    this.hiddenByStep.set(1, [3, 4, 5, 6, 7, 8, 9, 10]);
    this.hiddenByStep.set(2, [0, 1, 2, 3, 7, 8, 9, 10]);
    this.hiddenByStep.set(3, [0, 1, 2, 3, 7, 8, 9, 10]);
    this.hiddenByStep.set(4, [0, 1, 2, 3, 4, 5, 6]);

    const controllers = [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10];
    controllers.forEach((controller, index) => {
      controller.onChange(() => {
        this.updateTransforms();
        this.updatePanel();
      });
      controller.domElement.dataset["wizardIndex"] = String(index);
    });

    folder.open();
  }

  private resetDemo(): void {
    this.updateTransforms();
    this.updatePanel();
  }

  private updateTransforms(): void {
    if (!this.eulerObject || !this.quaternionObject) {
      return;
    }

    this.setLayoutForStep();

    if (this.currentStep === 0) {
      this.eulerObject.rotation.set(0, THREE.MathUtils.degToRad(this.params.yawDeg), 0, "YXZ");
      this.quaternionObject.visible = false;
      return;
    }

    if (this.currentStep === 1) {
      this.eulerState.order = this.params.order;
      this.eulerState.set(
        THREE.MathUtils.degToRad(this.params.pitchDeg),
        THREE.MathUtils.degToRad(this.params.yawDeg),
        0,
        this.params.order
      );
      this.eulerObject.rotation.copy(this.eulerState);
      this.quaternionObject.visible = false;
      return;
    }

    if (this.currentStep === 2) {
      this.applyGimbalEulerOnly();
      this.quaternionObject.visible = false;
      return;
    }

    if (this.currentStep === 3) {
      // Left: standard Euler YXZ (roll = local Z, suffers from gimbal lock)
      this.applyGimbalEulerOnly();
      this.quaternionObject.visible = true;

      // Right: world-space quaternion composition
      // Each axis is always the WORLD axis, never a local rotated axis.
      // q = qZ_world(roll) * qY_world(yaw) * qX_world(pitch)
      const pitch = THREE.MathUtils.degToRad(this.params.gimbalPitchDeg);
      const yaw   = THREE.MathUtils.degToRad(this.params.gimbalYawDeg);
      const roll  = THREE.MathUtils.degToRad(this.params.gimbalRollDeg);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
      const qYaw   = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const qRoll  = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll);
      // leftmost = applied last in world space = world-Z roll always independent
      this.quaternionObject.quaternion.copy(qRoll).multiply(qYaw).multiply(qPitch).normalize();
      return;
    }

    const axis = new THREE.Vector3(this.params.axisX, this.params.axisY, this.params.axisZ);
    if (axis.lengthSq() < 1e-6) axis.set(0, 1, 0);
    axis.normalize();
    this.quaternionObject.quaternion.setFromAxisAngle(axis, THREE.MathUtils.degToRad(this.params.angleDeg)).normalize();
    this.eulerObject.quaternion.copy(this.quaternionObject.quaternion);
    this.quaternionObject.visible = true;

    if (this.axisArrow) {
      this.axisArrow.visible = true;
      this.axisArrow.position.copy(this.quaternionObject.position);
      this.axisArrow.setDirection(axis);
    }
  }

  private setLayoutForStep(): void {
    if (!this.eulerObject || !this.quaternionObject) {
      return;
    }

    if (this.axisArrow && this.currentStep !== 4) {
      this.axisArrow.visible = false;
    }

    if (this.currentStep <= 2) {
      this.eulerObject.position.set(0, 0.75, 0);
      this.quaternionObject.position.set(3.2, 0.75, 0);
      this.eulerObject.visible = true;
      return;
    }

    this.eulerObject.position.set(-3.2, 0.75, 0);
    this.quaternionObject.position.set(3.2, 0.75, 0);
    this.eulerObject.visible = true;
  }

  private applyGimbalEulerOnly(): void {
    if (!this.eulerObject) {
      return;
    }

    const pitch = THREE.MathUtils.degToRad(this.params.gimbalPitchDeg);
    const yaw = THREE.MathUtils.degToRad(this.params.gimbalYawDeg);
    const roll = THREE.MathUtils.degToRad(this.params.gimbalRollDeg);

    this.eulerObject.rotation.set(pitch, yaw, roll, "YXZ");
  }

  private goToStep(step: WizardStep): void {
    const clamped = Math.max(0, Math.min(4, step)) as WizardStep;
    this.currentStep = clamped;
    this.renderCurrentStep();
    this.resetDemo();
  }

  private renderCurrentStep(): void {
    if (this.prevButton && this.nextButton) {
      this.prevButton.disabled = this.currentStep === 0;
      this.nextButton.disabled = this.currentStep === 4;
    }

    if (!this.gui) {
      return;
    }

    const hidden = this.hiddenByStep.get(this.currentStep) ?? [];
    const rows = Array.from(this.gui.domElement.querySelectorAll(".controller"));
    rows.forEach((row) => {
      const idxRaw = (row as HTMLElement).dataset["wizardIndex"];
      if (idxRaw === undefined) return;
      const idx = Number(idxRaw);
      (row as HTMLElement).style.display = hidden.includes(idx) ? "none" : "";
    });
  }

  private updatePanel(): void {
    if (!this.infoText || !this.eulerObject || !this.quaternionObject) {
      return;
    }

    const q = this.quaternionObject.quaternion;
    const norm = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
    const angle = 2 * Math.acos(THREE.MathUtils.clamp(q.w, -1, 1));
    const sinHalf = Math.sqrt(Math.max(0, 1 - q.w * q.w));
    const axis = sinHalf > 1e-5
      ? new THREE.Vector3(q.x / sinHalf, q.y / sinHalf, q.z / sinHalf)
      : new THREE.Vector3(1, 0, 0);

    const e = this.eulerObject.rotation;
    const eulerDeg = {
      x: THREE.MathUtils.radToDeg(e.x),
      y: THREE.MathUtils.radToDeg(e.y),
      z: THREE.MathUtils.radToDeg(e.z),
    };

    const step = this.currentStep;
    if (step === 0) {
      this.infoText.textContent = [
        "Etape 1/5 - Euler tres simple",
        "",
        "Tu ne modifies qu'un seul angle: Yaw.",
        "Observe le de: les faces numerotees rendent la rotation evidente.",
        "",
        "Euler = 3 angles (yaw, pitch, roll).",
        "Ici on commence avec 1 angle pour construire l'intuition.",
        "",
        `Yaw = ${this.params.yawDeg.toFixed(1)} deg`,
      ].join("\n");
      return;
    }

    if (step === 1) {
      const yawRad = THREE.MathUtils.degToRad(this.params.yawDeg);
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRad);
      const pitchAxisWorld = new THREE.Vector3(1, 0, 0).applyQuaternion(qYaw);

      this.infoText.textContent = [
        "Etape 2/5 - Yaw puis Pitch",
        "",
        "On applique d'abord Yaw (rotation autour de Y monde).",
        "Puis Pitch tourne autour de l'axe X LOCAL du de,",
        "c'est-a-dire l'axe X apres le yaw.",
        "",
        `Yaw = ${this.params.yawDeg.toFixed(1)} deg`,
        `Pitch = ${this.params.pitchDeg.toFixed(1)} deg`,
        `Ordre = ${this.params.order}`,
        "",
        "Axe pitch dans le monde apres yaw :",
        `  (${pitchAxisWorld.x.toFixed(3)}, ${pitchAxisWorld.y.toFixed(3)}, ${pitchAxisWorld.z.toFixed(3)})`,
        "",
        "Essaie: yaw=0 vs yaw=90, puis bouge Pitch.",
        "Le pitch tourne dans des directions mondiales differentes.",
        "2e angle depend du 1er → c'est la fragilite d'Euler.",
      ].join("\n");
      return;
    }

    if (step === 2) {
      const pitch = THREE.MathUtils.degToRad(this.params.gimbalPitchDeg);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
      const yawAxis = new THREE.Vector3(0, 1, 0);
      const rollAxisAfterPitch = new THREE.Vector3(0, 0, 1).applyQuaternion(qPitch).normalize();
      const alignment = Math.abs(yawAxis.dot(rollAxisAfterPitch));
      const lockPct = (alignment * 100).toFixed(0);

      this.infoText.textContent = [
        "Etape 3/5 - Le probleme des angles Euler",
        "",
        "Rappel: chaque angle tourne autour d'un axe LOCAL,",
        "c'est-a-dire l'axe apres les rotations precedentes.",
        "",
        "Quand Pitch s'approche de 90 deg, l'axe local Z",
        "(celui du Roll) s'aligne avec l'axe mondial Y (celui du Yaw).",
        "Yaw et Roll deviennent alors le meme geste physique.",
        "",
        `Pitch = ${this.params.gimbalPitchDeg.toFixed(1)} deg`,
        `Yaw = ${this.params.gimbalYawDeg.toFixed(1)} deg`,
        `Roll = ${this.params.gimbalRollDeg.toFixed(1)} deg`,
        `Axe Roll aligne avec axe Yaw: ${lockPct}%`,
        "",
        "Essaie: monte Pitch a 89 deg, puis bouge Yaw et Roll.",
        "Les deux sliders font tourner le cube dans le meme sens.",
        "Tu as perdu un degre de liberte: impossible de pointer",
        "dans certaines directions sans changer Pitch d'abord.",
        "",
        "C'est le Gimbal Lock: un état ou 3 angles ne suffisent",
        "plus a decrire les 3 degrees de liberte de la rotation.",
      ].join("\n");
      return;
    }

    if (step === 3) {
      const qeL = this.eulerObject.quaternion;
      const sinHL = Math.sqrt(Math.max(0, 1 - qeL.w * qeL.w));
      const axisL = sinHL > 1e-5
        ? new THREE.Vector3(qeL.x / sinHL, qeL.y / sinHL, qeL.z / sinHL)
        : new THREE.Vector3(1, 0, 0);

      this.infoText.textContent = [
        "Etape 4/5 - Quaternion: axes monde toujours independants",
        "",
        "Gauche (Euler): chaque angle tourne autour d'un axe LOCAL.",
        "  → A pitch=89, l'axe du Roll est presque identique a celui du Yaw.",
        "  → Bouger Roll ou Yaw donne le meme effet physique.",
        "",
        "Droite (Quaternion): chaque axe est toujours l'axe MONDE.",
        "  → Yaw = toujours autour de Y monde.",
        "  → Roll = toujours autour de Z monde.",
        "  → Les deux restent independants quel que soit Pitch.",
        "",
        "Essaie: pitch=89, puis bouge Yaw et Roll separement.",
        "Gauche: cube a peu pres immobile pour l'un des deux.",
        "Droite: cube repond distinctement a chaque commande.",
        "",
        `Gauche axe equiv = (${axisL.x.toFixed(3)}, ${axisL.y.toFixed(3)}, ${axisL.z.toFixed(3)})`,
        `Droite axe equiv = (${axis.x.toFixed(3)}, ${axis.y.toFixed(3)}, ${axis.z.toFixed(3)})`,
        `Droite q = (${q.x.toFixed(4)}, ${q.y.toFixed(4)}, ${q.z.toFixed(4)}, ${q.w.toFixed(4)})`,
        `||q|| = ${norm.toFixed(6)}`,
      ].join("\n");
      return;
    }

    this.tmpEuler.setFromQuaternion(this.quaternionObject.quaternion, "YXZ");
    const recovered = {
      x: THREE.MathUtils.radToDeg(this.tmpEuler.x),
      y: THREE.MathUtils.radToDeg(this.tmpEuler.y),
      z: THREE.MathUtils.radToDeg(this.tmpEuler.z),
    };

    this.tmpVector.set(this.params.axisX, this.params.axisY, this.params.axisZ);
    if (this.tmpVector.lengthSq() < 1e-6) this.tmpVector.set(0, 1, 0);
    this.tmpVector.normalize();

    this.infoText.textContent = [
      "Etape 5/5 - Playground composantes quaternion",
      "",
      "Tu choisis un axe + un angle.",
      "Le quaternion est mis a jour en direct.",
      "",
      "Formule:",
      "q = [nx*sin(theta/2), ny*sin(theta/2), nz*sin(theta/2), cos(theta/2)]",
      "",
      `Axe normalise = (${this.tmpVector.x.toFixed(3)}, ${this.tmpVector.y.toFixed(3)}, ${this.tmpVector.z.toFixed(3)})`,
      `Angle = ${this.params.angleDeg.toFixed(1)} deg`,
      `q = (${q.x.toFixed(5)}, ${q.y.toFixed(5)}, ${q.z.toFixed(5)}, ${q.w.toFixed(5)})`,
      `||q|| = ${norm.toFixed(6)}`,
      `Axe approx depuis q = (${axis.x.toFixed(3)}, ${axis.y.toFixed(3)}, ${axis.z.toFixed(3)})`,
      `Angle approx depuis q = ${THREE.MathUtils.radToDeg(angle).toFixed(2)} deg`,
      "",
      "Equivalent Euler (lecture) =",
      `yaw/pitch/roll ~ ${recovered.y.toFixed(1)} / ${recovered.x.toFixed(1)} / ${recovered.z.toFixed(1)} deg`,
      "",
      `Euler objet (gauche) = ${eulerDeg.y.toFixed(1)} / ${eulerDeg.x.toFixed(1)} / ${eulerDeg.z.toFixed(1)} deg`,
    ].join("\n");
  }
}
