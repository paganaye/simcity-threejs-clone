import * as THREE from 'three';
import { RoadSegment } from './RoadSegment';
import { getBands } from './RoadLayout';
import type { IRoadCuts, IExtremityCut } from '../textures/RoadBuilder';
import { RoadPrimitiveCompiler, RoadPrimitive } from './RoadPrimitiveCompiler';

export class RoadNetwork {
    readonly segments: RoadSegment[] = [];
    private readonly transientJoinArcs: RoadSegment[] = [];
    private readonly primitiveCompiler = new RoadPrimitiveCompiler();
    private compiledPrimitives: RoadPrimitive[] = [];
    private static readonly JOIN_EPSILON = 0.35;
    private static readonly JOIN_TARGET_RADIUS = 2.0;
    // Visual helper arcs may consume almost all of a short segment; keep a tiny remainder only.
    private static readonly JOIN_MIN_REMAINING_LENGTH = 0.05;

    private static getInteriorCarriagewayWidth(segment: RoadSegment): number {
        const road = segment.getIRoad();
        const forwardWidth = getBands(road.forward).carriagewayWidthM;
        if (!road.backward) return forwardWidth;
        const backwardWidth = getBands(road.backward).carriagewayWidthM;
        return Math.min(forwardWidth, backwardWidth);
    }

    registerSegment(segment: RoadSegment): RoadSegment {
        if (!this.segments.includes(segment)) {
            this.segments.push(segment);
            this.refreshTransientJoinArcs();
        }
        return segment;
    }

    removeSegment(segment: RoadSegment): boolean {
        const index = this.segments.indexOf(segment);
        if (index < 0) return false;
        this.segments.splice(index, 1);
        segment.dispose();
        this.refreshTransientJoinArcs();
        return true;
    }

    clear(): void {
        this.clearTransientJoinArcs();
        for (const segment of [...this.segments]) {
            segment.dispose();
        }
        this.segments.length = 0;
        this.compiledPrimitives = [];
    }

    getCompiledPrimitives(): RoadPrimitive[] {
        return this.compiledPrimitives.slice();
    }

    refreshTransientJoinArcs(): void {
        this.clearTransientJoinArcs();
        const nextPrimitives = this.segments.flatMap((segment) => this.primitiveCompiler.compileSegment(segment));

        const editable = this.segments.filter((segment) => segment.arcMidX === undefined && segment.arcMidZ === undefined);
        const usedEndpointKeys = new Set<string>();
        const trimsBySegment = new Map<RoadSegment, { start: number; end: number }>();
        const maybeSetJunctionCuts = (segment: RoadSegment, cuts?: { forwardCuts?: IRoadCuts; backwardCuts?: IRoadCuts }): void => {
            const withMethod = segment as unknown as { setJunctionCuts?: (value?: { forwardCuts?: IRoadCuts; backwardCuts?: IRoadCuts }) => void };
            withMethod.setJunctionCuts?.(cuts);
        };

        for (const segment of editable) {
            // Transient joins fully define temporary trims for this frame.
            maybeSetJunctionCuts(segment, undefined);
        }

        type Endpoint = {
            segment: RoadSegment;
            key: string;
            isStart: boolean;
            point: { x: number; z: number };
            dirAway: { x: number; z: number };
        };

        const getEndpoints = (segment: RoadSegment): Endpoint[] => {
            const dir = { x: Math.cos(segment.angle), z: -Math.sin(segment.angle) };
            return [
                {
                    segment,
                    key: `${segment.group.id}:start`,
                    isStart: true,
                    point: { x: segment.startX, z: segment.startZ },
                    dirAway: { x: dir.x, z: dir.z },
                },
                {
                    segment,
                    key: `${segment.group.id}:end`,
                    isStart: false,
                    point: { x: segment.endX, z: segment.endZ },
                    dirAway: { x: -dir.x, z: -dir.z },
                },
            ];
        };

        const applyEndpointTrim = (endpoint: Endpoint, trim: number): void => {
            const previous = trimsBySegment.get(endpoint.segment) ?? { start: 0, end: 0 };
            if (endpoint.isStart) {
                previous.start = Math.max(previous.start, trim);
            } else {
                previous.end = Math.max(previous.end, trim);
            }
            trimsBySegment.set(endpoint.segment, previous);
        };

        for (let i = 0; i < editable.length; i++) {
            const left = editable[i];
            if (!left) continue;
            for (let j = i + 1; j < editable.length; j++) {
                const right = editable[j];
                if (!right) continue;

                const leftEndpoints = getEndpoints(left);
                const rightEndpoints = getEndpoints(right);

                for (const a of leftEndpoints) {
                    if (usedEndpointKeys.has(a.key)) continue;
                    for (const b of rightEndpoints) {
                        if (usedEndpointKeys.has(b.key)) continue;

                        const distance = Math.hypot(a.point.x - b.point.x, a.point.z - b.point.z);
                        if (distance > RoadNetwork.JOIN_EPSILON) continue;

                        const dot = THREE.MathUtils.clamp(a.dirAway.x * b.dirAway.x + a.dirAway.z * b.dirAway.z, -1, 1);
                        const phi = Math.acos(dot);
                        if (phi < 0.2 || phi > Math.PI - 0.2) continue;

                        const tanHalf = Math.tan(phi / 2);
                        if (!Number.isFinite(tanHalf) || tanHalf <= 1e-6) continue;

                        const maxTrimA = a.segment.length - RoadNetwork.JOIN_MIN_REMAINING_LENGTH;
                        const maxTrimB = b.segment.length - RoadNetwork.JOIN_MIN_REMAINING_LENGTH;
                        const maxTrim = Math.min(maxTrimA, maxTrimB);
                        if (!Number.isFinite(maxTrim) || maxTrim <= 0) continue;

                        const maxRadius = maxTrim * tanHalf;
                        const minInteriorRadius = Math.min(
                            RoadNetwork.getInteriorCarriagewayWidth(a.segment),
                            RoadNetwork.getInteriorCarriagewayWidth(b.segment),
                        );
                        const preferredRadius = Math.max(RoadNetwork.JOIN_TARGET_RADIUS, minInteriorRadius);
                        if (maxRadius < minInteriorRadius) continue;
                        const radius = Math.min(preferredRadius, maxRadius);
                        if (!Number.isFinite(radius) || radius <= 0.05) continue;

                        const trim = radius / tanHalf;
                        const node = {
                            x: (a.point.x + b.point.x) / 2,
                            z: (a.point.z + b.point.z) / 2,
                        };
                        const p1 = {
                            x: node.x + a.dirAway.x * trim,
                            z: node.z + a.dirAway.z * trim,
                        };
                        const p2 = {
                            x: node.x + b.dirAway.x * trim,
                            z: node.z + b.dirAway.z * trim,
                        };

                        const sceneRoot = a.segment.group.parent ?? b.segment.group.parent;
                        if (!sceneRoot) continue;

                        const chordDx = p2.x - p1.x;
                        const chordDz = p2.z - p1.z;
                        const chordLength = Math.hypot(chordDx, chordDz);
                        if (chordLength <= 1e-6) continue;

                        const helper = new RoadSegment(
                            sceneRoot,
                            p1.x,
                            p1.z,
                            Math.atan2(-chordDz, chordDx),
                            chordLength,
                            a.segment.getIRoad(),
                        );

                        const bisector = {
                            x: a.dirAway.x + b.dirAway.x,
                            z: a.dirAway.z + b.dirAway.z,
                        };
                        const bisectorLength = Math.hypot(bisector.x, bisector.z);
                        if (!Number.isFinite(bisectorLength) || bisectorLength <= 1e-6) continue;

                        const sinHalf = Math.sin(phi / 2);
                        if (!Number.isFinite(sinHalf) || sinHalf <= 1e-6) continue;

                        const centerDistance = radius / sinHalf;
                        const center = {
                            x: node.x + (bisector.x / bisectorLength) * centerDistance,
                            z: node.z + (bisector.z / bisectorLength) * centerDistance,
                        };

                        const a1 = Math.atan2(p1.z - center.z, p1.x - center.x);
                        const a2 = Math.atan2(p2.z - center.z, p2.x - center.x);
                        let delta = a2 - a1;
                        while (delta > Math.PI) delta -= Math.PI * 2;
                        while (delta <= -Math.PI) delta += Math.PI * 2;

                        if (Math.abs(delta) < 1e-5) continue;

                        const amid = a1 + delta / 2;
                        const mid = { x: center.x + Math.cos(amid) * radius, z: center.z + Math.sin(amid) * radius };
                        helper.setArc(mid.x, mid.z, p2.x, p2.z);

                        nextPrimitives.push(this.primitiveCompiler.compileTransientJoinArc({
                            id: `join:${a.key}:${b.key}:forward`,
                            direction: 'forward',
                            start: { x: p1.x, z: p1.z },
                            mid: { x: mid.x, z: mid.z },
                            end: { x: p2.x, z: p2.z },
                            roadType: a.segment.getIRoad().forward,
                        }));

                        const backwardRoad = a.segment.getIRoad().backward;
                        if (backwardRoad) {
                            nextPrimitives.push(this.primitiveCompiler.compileTransientJoinArc({
                                id: `join:${a.key}:${b.key}:backward`,
                                direction: 'backward',
                                start: { x: p2.x, z: p2.z },
                                mid: { x: mid.x, z: mid.z },
                                end: { x: p1.x, z: p1.z },
                                roadType: backwardRoad,
                            }));
                        }

                        // Helper arcs are visual-only (not selectable/editable road segments).
                        helper.group.userData.selectableType = undefined;
                        delete helper.group.userData.roadSegment;
                        helper.group.traverse((obj) => {
                            obj.userData.selectableType = undefined;
                            delete obj.userData.roadSegment;
                        });

                        this.transientJoinArcs.push(helper);
                        applyEndpointTrim(a, trim);
                        applyEndpointTrim(b, trim);
                        usedEndpointKeys.add(a.key);
                        usedEndpointKeys.add(b.key);
                        break;
                    }
                }
            }
        }

        const toExtremityCut = (trim: number): IExtremityCut => ({
            left: trim,
            roadLeft: trim,
            roadRight: trim,
            right: trim,
        });

        for (const segment of editable) {
            const trims = trimsBySegment.get(segment);
            if (!trims) continue;

            const forwardCuts: IRoadCuts = {};
            if (trims.start > 1e-4) {
                forwardCuts.startCut = toExtremityCut(trims.start);
            }
            if (trims.end > 1e-4) {
                forwardCuts.endCut = toExtremityCut(trims.end);
            }

            if (!forwardCuts.startCut && !forwardCuts.endCut) continue;
            maybeSetJunctionCuts(segment, {
                forwardCuts,
                backwardCuts: { ...forwardCuts },
            });
        }

        this.compiledPrimitives = nextPrimitives;
    }

    private clearTransientJoinArcs(): void {
        for (const arc of this.transientJoinArcs) {
            arc.dispose();
        }
        this.transientJoinArcs.length = 0;
    }

    
    static findCrossJunction(
        first: RoadSegment,
        second: RoadSegment,
    ): { x: number; z: number; angle: number; mainRoad: ReturnType<RoadSegment['getIRoad']>; crossingRoad: ReturnType<RoadSegment['getIRoad']> } | null {
        if (first.arcMidX !== undefined || first.arcMidZ !== undefined) return null;
        if (second.arcMidX !== undefined || second.arcMidZ !== undefined) return null;

        const angleDelta = Math.abs(RoadNetwork.normalizeAngle(first.angle - second.angle));
        const rightAngleDelta = Math.abs(angleDelta - Math.PI / 2);
        if (rightAngleDelta > 0.2) {
            return null;
        }

        const intersection = RoadNetwork.segmentIntersection(
            { x: first.startX, z: first.startZ },
            { x: first.endX, z: first.endZ },
            { x: second.startX, z: second.startZ },
            { x: second.endX, z: second.endZ },
        );
        if (!intersection) {
            return null;
        }

        return {
            x: intersection.x,
            z: intersection.z,
            angle: first.angle,
            mainRoad: first.getIRoad(),
            crossingRoad: second.getIRoad(),
        };
    }

    static segmentIntersection(
        a0: { x: number; z: number },
        a1: { x: number; z: number },
        b0: { x: number; z: number },
        b1: { x: number; z: number },
    ): { x: number; z: number } | null {
        const r = { x: a1.x - a0.x, z: a1.z - a0.z };
        const s = { x: b1.x - b0.x, z: b1.z - b0.z };
        const denominator = r.x * s.z - r.z * s.x;
        if (Math.abs(denominator) < 1e-6) {
            return null;
        }

        const qp = { x: b0.x - a0.x, z: b0.z - a0.z };
        const t = (qp.x * s.z - qp.z * s.x) / denominator;
        const u = (qp.x * r.z - qp.z * r.x) / denominator;
        const epsilon = 1e-4;
        if (t <= epsilon || t >= 1 - epsilon || u <= epsilon || u >= 1 - epsilon) {
            return null;
        }

        return {
            x: a0.x + t * r.x,
            z: a0.z + t * r.z,
        };
    }

    static normalizeAngle(angle: number): number {
        let normalized = angle;
        while (normalized > Math.PI) normalized -= Math.PI * 2;
        while (normalized <= -Math.PI) normalized += Math.PI * 2;
        return Math.abs(normalized);
    }

    
}
