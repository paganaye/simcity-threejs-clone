import { Accessor, Show } from "solid-js";
import type * as THREE from "three";
import type { ISelectedInstance } from "./editor/CustomGizmo";

export function SelectedObjectPanel(props: {
    selectedInstance: Accessor<ISelectedInstance | undefined>;
    selectedCustomObject: Accessor<THREE.Object3D | undefined>;
}) {
    const customObject = () => props.selectedCustomObject();
    const instance = () => props.selectedInstance();

    return (
        <Show when={customObject() || instance()}>
            <div id="selected-object-panel" class="container">
                <div class="selected-object-panel-title">Selected Object</div>
                <Show
                    when={customObject()}
                    fallback={
                        <div class="selected-object-panel-content">
                            <div class="info-heading">Instance</div>
                            <div>
                                <span class="info-label">Type </span>
                                <span class="info-value">{instance()?.selectableType}</span>
                            </div>
                            <div>
                                <span class="info-label">Model </span>
                                <span class="info-value">{String(instance()?.mesh.userData?.modelName ?? "unknown")}</span>
                            </div>
                            <div>
                                <span class="info-label">InstanceId </span>
                                <span class="info-value">{instance()?.instanceId}</span>
                            </div>
                        </div>
                    }
                >
                    <div class="selected-object-panel-content">
                        <div class="info-heading">Object</div>
                        <div>
                            <span class="info-label">Type </span>
                            <span class="info-value">{String(customObject()?.userData?.selectableType ?? customObject()?.type ?? "object")}</span>
                        </div>
                        <div>
                            <span class="info-label">Name </span>
                            <span class="info-value">{String(customObject()?.userData?.handleKey ?? customObject()?.name ?? "unnamed")}</span>
                        </div>
                        <div>
                            <span class="info-label">Id </span>
                            <span class="info-value">{String(customObject()?.id ?? "")}</span>
                        </div>
                    </div>
                </Show>
            </div>
        </Show>
    );
}