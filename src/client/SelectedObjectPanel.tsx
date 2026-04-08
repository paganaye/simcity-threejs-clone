import { Accessor, Show, createEffect, createSignal } from "solid-js";
import type * as THREE from "three";
import type { ISelectedInstance } from "./editor/ObjectGizmo";
import type { Character, CharacterSelectionInfo } from "./Character";
import type { RoadSegment } from "./RoadSegment";
import type { IRoad, IRoadOptions, KerbType, SideWalkType } from "./roads/IRoad";

function RoadOptionsInput(props: {
    title: string;
    options: IRoadOptions;
    shoulderOptions: KerbType[];
    sidewalkOptions: SideWalkType[];
    laneWidthOptions: readonly string[];
    idPrefix: string;
    onOptionsChange: (patch: Partial<IRoadOptions>) => void;
}) {
    return (
        <>
            <div class="info-heading">{props.title}</div>
            <div class="road-form-row">
                <label class="info-label" for={`${props.idPrefix}-color`}>Color</label>
                <select id={`${props.idPrefix}-color`} class="road-input" value={props.options.roadColor} onChange={(ev) => props.onOptionsChange({ roadColor: ev.currentTarget.value as "old" | "new" })}>
                    <option value="old">old</option>
                    <option value="new">new</option>
                </select>
            </div>
            <div class="road-form-row">
                <label class="info-label" for={`${props.idPrefix}-lanes`}>Lanes</label>
                <input id={`${props.idPrefix}-lanes`} class="road-input" type="number" min="0" step="1" value={String(props.options.lanes)} onChange={(ev) => props.onOptionsChange({ lanes: Math.max(0, Number(ev.currentTarget.value) || 0) })} />
            </div>
            <div class="road-form-row">
                <label class="info-label" for={`${props.idPrefix}-right-kerb`}>Right kerb</label>
                <select id={`${props.idPrefix}-right-kerb`} class="road-input" value={props.options.rightKerb} onChange={(ev) => props.onOptionsChange({ rightKerb: ev.currentTarget.value as KerbType })}>
                    {props.shoulderOptions.map((value) => <option value={value}>{value}</option>)}
                </select>
            </div>
            <div class="road-form-row">
                <label class="info-label" for={`${props.idPrefix}-right-shoulder`}>Right shoulder</label>
                <select id={`${props.idPrefix}-right-shoulder`} class="road-input" value={props.options.rightSidewalk} onChange={(ev) => props.onOptionsChange({ rightSidewalk: ev.currentTarget.value as SideWalkType })}>
                    {props.sidewalkOptions.map((value) => <option value={value}>{value}</option>)}
                </select>
            </div>
            <div class="road-form-row">
                <label class="info-label" for={`${props.idPrefix}-left-kerb`}>Left kerb</label>
                <select id={`${props.idPrefix}-left-kerb`} class="road-input" value={props.options.leftKerb} onChange={(ev) => props.onOptionsChange({ leftKerb: ev.currentTarget.value as KerbType })}>
                    {props.shoulderOptions.map((value) => <option value={value}>{value}</option>)}
                </select>
            </div>
            <div class="road-form-row">
                <label class="info-label" for={`${props.idPrefix}-left-shoulder`}>Left shoulder</label>
                <select id={`${props.idPrefix}-left-shoulder`} class="road-input" value={props.options.leftSidewalk} onChange={(ev) => props.onOptionsChange({ leftSidewalk: ev.currentTarget.value as SideWalkType })}>
                    {props.sidewalkOptions.map((value) => <option value={value}>{value}</option>)}
                </select>
            </div>
            <div class="road-form-row">
                <label class="info-label" for={`${props.idPrefix}-road-width`}>Lane width</label>
                <select id={`${props.idPrefix}-road-width`} class="road-input" value={props.options.laneWidth} onChange={(ev) => props.onOptionsChange({ laneWidth: ev.currentTarget.value as "narrow" | "normal" | "wide" })}>
                    {props.laneWidthOptions.map((value) => <option value={value}>{value}</option>)}
                </select>
            </div>
        </>
    );
}

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
    const shoulderOptions: KerbType[] = ["parallelParking", "perpendicularParking", "emergencyLane", "line", "gap", "none"];
    const sidewalkOptions: SideWalkType[] = ["small", "large", "grass", "none"];
    const laneWidthOptions = ["narrow", "normal", "wide"] as const;
    const [roadDraft, setRoadDraft] = createSignal<IRoad>({
        forward: { roadColor: "old", lanes: 1, rightKerb: "none", rightSidewalk: "small", laneWidth: "normal", leftKerb: "none", leftSidewalk: "none" },
        backward: { roadColor: "old", lanes: 1, rightKerb: "none", rightSidewalk: "small", laneWidth: "normal", leftKerb: "none", leftSidewalk: "none" },
        gapSize: 0,
    });
    const oneWayDraft = (): IRoad | undefined => {
        const draft = roadDraft();
        return draft.backward ? undefined : draft;
    };

    const twoWayDraft = (): IRoad | undefined => {
        const draft = roadDraft();
        return draft.backward ? draft : undefined;
    };

    createEffect(() => {
        const road = selectedRoad();
        if (!road) return;
        const current = road.getIRoad();
        setRoadDraft({
            forward: { ...current.forward },
            backward: current.backward ? { ...current.backward } : undefined,
            gapSize: current.gapSize,
        });
    });

    const commitRoadDraft = (next: IRoad): void => {
        setRoadDraft(next);
        const road = selectedRoad();
        if (!road) return;
        road.setIRoad(next);
    };

    const setRoadKind = (kind: "one-way" | "two-way"): void => {
        const current = roadDraft();
        if (kind === "one-way") {
            commitRoadDraft({
                forward: { ...current.forward },
                backward: undefined,
                gapSize: 0,
            });
            return;
        }
        const base = current.forward;
        commitRoadDraft({
            forward: { ...base },
            backward: current.backward ? { ...current.backward } : { ...base },
            gapSize: 0,
        });
    };

    const updateForwardOptions = (patch: Partial<IRoadOptions>): void => {
        const current = roadDraft();
        commitRoadDraft({
            forward: { ...current.forward, ...patch },
            backward: current.backward ? { ...current.backward } : undefined,
            gapSize: current.gapSize,
        });
    };

    const updateBackwardOptions = (patch: Partial<IRoadOptions>): void => {
        const current = roadDraft();
        if (!current.backward) return;
        commitRoadDraft({
            forward: { ...current.forward },
            backward: { ...current.backward, ...patch },
            gapSize: current.gapSize,
        });
    };

    const updateGapSize = (rawValue: string): void => {
        const current = roadDraft();
        if (!current.backward) return;
        commitRoadDraft({
            forward: { ...current.forward },
            backward: { ...current.backward },
            gapSize: Math.max(0, Number(rawValue) || 0),
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
                                    value={!roadDraft().backward ? "one-way" : "two-way"}
                                    onChange={(ev) => setRoadKind(ev.currentTarget.value as "one-way" | "two-way")}
                                >
                                    <option value="one-way">OneWayRoad</option>
                                    <option value="two-way">TwoWayRoad</option>
                                </select>
                            </div>
                            <Show when={true}>
                                <div class="road-form-row">
                                    <label class="info-label" for="tw-gap-size">Gap (m)</label>
                                    <input id="tw-gap-size" class="road-input" type="number" min="0" step="0.1" value={String(twoWayDraft()?.gapSize ?? 0)} onChange={(ev) => updateGapSize(ev.currentTarget.value)} />
                                </div>
                            </Show>
                            <Show when={!roadDraft().backward}>
                                <RoadOptionsInput
                                    title="Options"
                                    options={oneWayDraft()!.forward}
                                    shoulderOptions={shoulderOptions}
                                    sidewalkOptions={sidewalkOptions}
                                    laneWidthOptions={laneWidthOptions}
                                    idPrefix="ow"
                                    onOptionsChange={updateForwardOptions}
                                />
                            </Show>
                            <Show when={roadDraft().backward}>
                                <RoadOptionsInput
                                    title="Forward Way"
                                    options={twoWayDraft()!.forward}
                                    shoulderOptions={shoulderOptions}
                                    sidewalkOptions={sidewalkOptions}
                                    laneWidthOptions={laneWidthOptions}
                                    idPrefix="tw-forward"
                                    onOptionsChange={updateForwardOptions}
                                />
                                <RoadOptionsInput
                                    title="Other Way"
                                    options={twoWayDraft()!.backward!}
                                    shoulderOptions={shoulderOptions}
                                    sidewalkOptions={sidewalkOptions}
                                    laneWidthOptions={laneWidthOptions}
                                    idPrefix="tw-other"
                                    onOptionsChange={updateBackwardOptions}
                                />
                            </Show>
                        </Show>
                    </div>
                </Show>
            </div>
        </Show>
    );
}