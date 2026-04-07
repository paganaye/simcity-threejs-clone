import { GameScene3D } from '../GameScene3D';
import { type ILeftPointerGesture } from '../GameScene3D';
import { ActiveTool } from './ToolTypes';


export abstract class ToolController {
    constructor(readonly scene3D: GameScene3D) {
    }

    abstract onToolChanged(tool: ActiveTool): void;

    onPointerDown(_event: PointerEvent, _gesture: ILeftPointerGesture): void {}
    onPointerMove(_event: PointerEvent, _gesture: ILeftPointerGesture): void {}
    onPointerUp(_event: PointerEvent, _gesture: ILeftPointerGesture): void {}
    onPointerCancel(): void {}
}
