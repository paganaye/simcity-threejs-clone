import { Accessor, Show, createEffect, createSignal } from "solid-js";
import type * as THREE from "three";
import type { ISelectedInstance } from "./editor/ObjectGizmo";
import type { Character, CharacterSelectionInfo } from "./Character";
import type { RoadSegment } from "./RoadSegment";
import type { DividingType, IRoad, IRoadOptions, OneWayRoad, ShoulderType, SideWalkType, TwoWayRoad } from "./roads/IRoad";

export function SelectedObjectPanel(props: {
    selectedInstance: Accessor<ISelectedInstance | undefined>;
    selectedCustomObject: Accessor<THREE.Object3D | undefined>;
}) {
    type CharacterResolver = (instanceId: number) => Character | undefined;
    const customObject = () => props.selectedCustomObject();
    const instance = () => props.selectedInstance();
    const selectedCharacter = (): Character | undefined => {
        const selected = instance();
        if (!selected || selected.selectableType !== "character") {
            return undefined;
        }
        const resolver = selected.mesh.userData?.characterResolver as CharacterResolver | undefined;
        return resolver?.(selected.instanceId);
    };
    const characterInfo = (): CharacterSelectionInfo[] => {
        return selectedCharacter()?.getSelectionInfo() ?? [];
    };
    const selectedRoad = (): RoadSegment | undefined => {
        const selected = customObject();
        if (!selected || selected.userData?.selectableType !== "road") {
            return undefined;
        }
        return selected.userData?.roadSegment as RoadSegment | undefined;
    };
    const shoulderOptions: ShoulderType[] = ["parallelParking", "perpendicularParking", "emergencyLane", "line", "gap", "none"];
    const sidewalkOptions: SideWalkType[] = ["small", "large", "none"];
    const dividingOptions: DividingType[] = ["yellowLineSolid", "yellowLineDashed", "gap", "none"];
    const [roadDraft, setRoadDraft] = createSignal<IRoad>({
        type: "TwoWayRoad",
        forwardWay: { roadColor: "old", lanes: 1, shoulder: "none", sidewalk: "small" },
        otherWay: { roadColor: "old", lanes: 1, shoulder: "none", sidewalk: "small" },
        dividing: "none",
    });
    const oneWayDraft = (): OneWayRoad | undefined => {
        const draft = roadDraft();
        return draft.type === "OneWayRoad" ? draft : undefined;
    };
    const twoWayDraft = (): TwoWayRoad | undefined => {
        const draft = roadDraft();
        return draft.type === "TwoWayRoad" ? draft : undefined;
    };

    createEffect(() => {
        const road = selectedRoad();
        if (!road) return;
        const current = road.getIRoad();
        setRoadDraft(current.type === "OneWayRoad"
            ? {
                type: "OneWayRoad",
                options: { ...current.options },
            }
            : {
                type: "TwoWayRoad",
                forwardWay: { ...current.forwardWay },
                otherWay: { ...current.otherWay },
                dividing: current.dividing,
            });
    });

    const commitRoadDraft = (next: IRoad): void => {
        setRoadDraft(next);
        const road = selectedRoad();
        if (!road) return;
        road.setIRoad(next);
    };

    const setRoadKind = (kind: "OneWayRoad" | "TwoWayRoad"): void => {
        const current = roadDraft();
        if (kind === "OneWayRoad") {
            const base = current.type === "OneWayRoad" ? current.options : current.forwardWay;
            commitRoadDraft({ type: "OneWayRoad", options: { ...base } });
            return;
        }
        const base = current.type === "TwoWayRoad" ? current.forwardWay : current.options;
        commitRoadDraft({
            type: "TwoWayRoad",
            forwardWay: { ...base },
            otherWay: { ...base },
            dividing: "none",
        });
    };

    const patchOneWay = (patch: Partial<IRoadOptions>): void => {
        const current = roadDraft();
        if (current.type !== "OneWayRoad") return;
        commitRoadDraft({ type: "OneWayRoad", options: { ...current.options, ...patch } });
    };

    const patchTwoWayForward = (patch: Partial<IRoadOptions>): void => {
        const current = roadDraft();
        if (current.type !== "TwoWayRoad") return;
        commitRoadDraft({
            type: "TwoWayRoad",
            forwardWay: { ...current.forwardWay, ...patch },
            otherWay: { ...current.otherWay },
            dividing: current.dividing,
        });
    };

    const patchTwoWayOther = (patch: Partial<IRoadOptions>): void => {
        const current = roadDraft();
        if (current.type !== "TwoWayRoad") return;
        commitRoadDraft({
            type: "TwoWayRoad",
            forwardWay: { ...current.forwardWay },
            otherWay: { ...current.otherWay, ...patch },
            dividing: current.dividing,
        });
    };

    const patchTwoWayDividing = (dividing: DividingType): void => {
        const current = roadDraft();
        if (current.type !== "TwoWayRoad") return;
        commitRoadDraft({
            type: "TwoWayRoad",
            forwardWay: { ...current.forwardWay },
            otherWay: { ...current.otherWay },
            dividing,
        });
    };

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
                            <Show when={characterInfo().length > 0}>
                                <div class="info-heading">Character</div>
                                {characterInfo().map((entry) => (
                                    <div>
                                        <span class="info-label">{entry.label} </span>
                                        <span class="info-value">{entry.value}</span>
                                    </div>
                                ))}
                            </Show>
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
                        <Show when={selectedRoad()}>
                            <div class="info-heading">Road Editor</div>
                            <div class="road-form-row">
                                <label class="info-label" for="road-kind-select">Type</label>
                                <select
                                    id="road-kind-select"
                                    class="road-input"
                                    value={roadDraft().type}
                                    onChange={(ev) => setRoadKind(ev.currentTarget.value as "OneWayRoad" | "TwoWayRoad")}
                                >
                                    <option value="OneWayRoad">OneWayRoad</option>
                                    <option value="TwoWayRoad">TwoWayRoad</option>
                                </select>
                            </div>
                            <Show when={roadDraft().type === "OneWayRoad"}>
                                <div class="info-heading">Options</div>
                                <div class="road-form-row">
                                    <label class="info-label" for="ow-road-color">Color</label>
                                    <select id="ow-road-color" class="road-input" value={oneWayDraft()?.options.roadColor ?? "old"} onChange={(ev) => patchOneWay({ roadColor: ev.currentTarget.value as "old" | "new" })}>
                                        <option value="old">old</option>
                                        <option value="new">new</option>
                                    </select>
                                </div>
                                <div class="road-form-row">
                                    <label class="info-label" for="ow-lanes">Lanes</label>
                                    <input id="ow-lanes" class="road-input" type="number" min="0" step="1" value={String(oneWayDraft()?.options.lanes ?? 1)} onChange={(ev) => patchOneWay({ lanes: Math.max(0, Number(ev.currentTarget.value) || 0) })} />
                                </div>
                                <div class="road-form-row">
                                    <label class="info-label" for="ow-shoulder">Shoulder</label>
                                    <select id="ow-shoulder" class="road-input" value={oneWayDraft()?.options.shoulder ?? "none"} onChange={(ev) => patchOneWay({ shoulder: ev.currentTarget.value as ShoulderType })}>
                                        {shoulderOptions.map((value) => <option value={value}>{value}</option>)}
                                    </select>
                                </div>
                                <div class="road-form-row">
                                    <label class="info-label" for="ow-sidewalk">Sidewalk</label>
                                    <select id="ow-sidewalk" class="road-input" value={oneWayDraft()?.options.sidewalk ?? "small"} onChange={(ev) => patchOneWay({ sidewalk: ev.currentTarget.value as SideWalkType })}>
                                        {sidewalkOptions.map((value) => <option value={value}>{value}</option>)}
                                    </select>
                                </div>
                            </Show>
                            <Show when={roadDraft().type === "TwoWayRoad"}>
                                <div class="info-heading">Forward Way</div>
                                <div class="road-form-row">
                                    <label class="info-label" for="tw-forward-color">Color</label>
                                    <select id="tw-forward-color" class="road-input" value={twoWayDraft()?.forwardWay.roadColor ?? "old"} onChange={(ev) => patchTwoWayForward({ roadColor: ev.currentTarget.value as "old" | "new" })}>
                                        <option value="old">old</option>
                                        <option value="new">new</option>
                                    </select>
                                </div>
                                <div class="road-form-row">
                                    <label class="info-label" for="tw-forward-lanes">Lanes</label>
                                    <input id="tw-forward-lanes" class="road-input" type="number" min="0" step="1" value={String(twoWayDraft()?.forwardWay.lanes ?? 1)} onChange={(ev) => patchTwoWayForward({ lanes: Math.max(0, Number(ev.currentTarget.value) || 0) })} />
                                </div>
                                <div class="road-form-row">
                                    <label class="info-label" for="tw-forward-shoulder">Shoulder</label>
                                    <select id="tw-forward-shoulder" class="road-input" value={twoWayDraft()?.forwardWay.shoulder ?? "none"} onChange={(ev) => patchTwoWayForward({ shoulder: ev.currentTarget.value as ShoulderType })}>
                                        {shoulderOptions.map((value) => <option value={value}>{value}</option>)}
                                    </select>
                                </div>
                                <div class="road-form-row">
                                    <label class="info-label" for="tw-forward-sidewalk">Sidewalk</label>
                                    <select id="tw-forward-sidewalk" class="road-input" value={twoWayDraft()?.forwardWay.sidewalk ?? "small"} onChange={(ev) => patchTwoWayForward({ sidewalk: ev.currentTarget.value as SideWalkType })}>
                                        {sidewalkOptions.map((value) => <option value={value}>{value}</option>)}
                                    </select>
                                </div>
                                <div class="info-heading">Other Way</div>
                                <div class="road-form-row">
                                    <label class="info-label" for="tw-other-color">Color</label>
                                    <select id="tw-other-color" class="road-input" value={twoWayDraft()?.otherWay.roadColor ?? "old"} onChange={(ev) => patchTwoWayOther({ roadColor: ev.currentTarget.value as "old" | "new" })}>
                                        <option value="old">old</option>
                                        <option value="new">new</option>
                                    </select>
                                </div>
                                <div class="road-form-row">
                                    <label class="info-label" for="tw-other-lanes">Lanes</label>
                                    <input id="tw-other-lanes" class="road-input" type="number" min="0" step="1" value={String(twoWayDraft()?.otherWay.lanes ?? 1)} onChange={(ev) => patchTwoWayOther({ lanes: Math.max(0, Number(ev.currentTarget.value) || 0) })} />
                                </div>
                                <div class="road-form-row">
                                    <label class="info-label" for="tw-other-shoulder">Shoulder</label>
                                    <select id="tw-other-shoulder" class="road-input" value={twoWayDraft()?.otherWay.shoulder ?? "none"} onChange={(ev) => patchTwoWayOther({ shoulder: ev.currentTarget.value as ShoulderType })}>
                                        {shoulderOptions.map((value) => <option value={value}>{value}</option>)}
                                    </select>
                                </div>
                                <div class="road-form-row">
                                    <label class="info-label" for="tw-other-sidewalk">Sidewalk</label>
                                    <select id="tw-other-sidewalk" class="road-input" value={twoWayDraft()?.otherWay.sidewalk ?? "small"} onChange={(ev) => patchTwoWayOther({ sidewalk: ev.currentTarget.value as SideWalkType })}>
                                        {sidewalkOptions.map((value) => <option value={value}>{value}</option>)}
                                    </select>
                                </div>
                                <div class="road-form-row">
                                    <label class="info-label" for="tw-dividing">Dividing</label>
                                    <select id="tw-dividing" class="road-input" value={twoWayDraft()?.dividing ?? "none"} onChange={(ev) => patchTwoWayDividing(ev.currentTarget.value as DividingType)}>
                                        {dividingOptions.map((value) => <option value={value}>{value}</option>)}
                                    </select>
                                </div>
                            </Show>
                        </Show>
                    </div>
                </Show>
            </div>
        </Show>
    );
}