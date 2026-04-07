import { ILeftPointerGesture } from '../GameScene3D';
import { ToolController } from './ToolController';
import { ActiveTool } from './ToolTypes';

export class SelectToolController extends ToolController {

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
