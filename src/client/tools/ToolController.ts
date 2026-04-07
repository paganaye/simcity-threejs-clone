import { GameScene3D } from '../GameScene3D';
import { Signal } from '../Signal';
import { ActiveTool } from './ToolTypes';


export abstract class ToolController {
    constructor(readonly scene3D: GameScene3D) {
    }

    abstract bind(activeTool: Signal<ActiveTool>): void;
    abstract onToolChanged(activeTool: Signal<ActiveTool>, tool: ActiveTool): void;

}
