import { ILeftPointerGesture } from '../GameScene3D';
import { ToolController } from './ToolController';
import { ActiveTool } from './ToolTypes';

export class SelectToolController extends ToolController {

    override onKeyDown(event: KeyboardEvent): boolean {
        const activeTool = this.scene3D.activeTool.get();

        if (event.key === 'Escape') {
            if (activeTool === 'select') {
                const hasSelection = !!this.scene3D.selectedObject.get();
                if (hasSelection) {
                    this.scene3D.clearSelection();
                    return true;
                }
                return false;
            }

            this.scene3D.setActiveTool('select');
            return true;
        }

        if (event.key === 'Delete' && activeTool === 'select') {
            return this.scene3D.deleteCurrentSelection();
        }

        return false;
    }

    onPointerDown(_event: PointerEvent, _gesture: ILeftPointerGesture): void {
        // we select on mouse_up
    }

    onToolChanged(tool: ActiveTool): void {
        if (tool !== 'select') return;
        const cursor = '';
        if (this.scene3D.renderDom) this.scene3D.renderDom.style.cursor = cursor;
        if (this.scene3D.objectGizmo) this.scene3D.objectGizmo.getDefaultCursor = () => cursor;
        if (this.scene3D.roadGizmo) this.scene3D.roadGizmo.getDefaultCursor = () => cursor;
    }

    onPointerUp(event: PointerEvent, gesture: ILeftPointerGesture): void {
        if (!gesture.moved && !gesture.consumedByGizmo) {
            this.scene3D.selectAtScreenPoint(event.clientX, event.clientY);
        }
    }
}
