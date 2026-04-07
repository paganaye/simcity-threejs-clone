import { Signal } from '../Signal';
import { ToolController } from './ToolController';
import { ActiveTool } from './ToolTypes';

export class SelectToolController extends ToolController {

    bind(activeTool: Signal<ActiveTool>): void {
        this.#applyToolCursor(activeTool);
    }

    onToolChanged(activeTool: Signal<ActiveTool>, tool: ActiveTool): void {
        if (tool !== 'select') return;
        this.#applyToolCursor(activeTool);
    }

    #applyToolCursor(activeTool: Signal<ActiveTool>): void {
        const renderDom = this.scene3D.renderDom;
        if (!renderDom) return;

        if (activeTool.get() !== 'select') return;

        renderDom.style.cursor = '';
        if (this.scene3D.objectGizmo) {
            this.scene3D.objectGizmo.getDefaultCursor = () => '';
        }
        if (this.scene3D.roadGizmo) {
            this.scene3D.roadGizmo.getDefaultCursor = () => '';
        }
    }
}
