import { Accessor, Show } from "solid-js";
import type { GizmoSelectedInstance } from "./editor/CustomGizmo";

export function SelectedObjectPanel(props: {
    selectedInstance: Accessor<GizmoSelectedInstance | undefined>;
}) {
    return (
        <Show when={props.selectedInstance()}>
            <div id="selected-object-panel" class="container">
                <div class="selected-object-panel-title">Selected Object</div>
                <div class="selected-object-panel-content">
                    <div class="info-heading">Instance</div>
                    <div>
                        <span class="info-label">Type </span>
                        <span class="info-value">{props.selectedInstance()?.selectableType}</span>
                    </div>
                    <div>
                        <span class="info-label">Model </span>
                        <span class="info-value">{String(props.selectedInstance()?.mesh.userData?.modelName ?? "unknown")}</span>
                    </div>
                    <div>
                        <span class="info-label">InstanceId </span>
                        <span class="info-value">{props.selectedInstance()?.instanceId}</span>
                    </div>
                </div>
            </div>
        </Show>
    );
}