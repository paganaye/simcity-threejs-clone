import * as THREE from 'three';
import { EPSILON, Segment, type IArc, type IPoint2D, type ISegment } from '../sim/Geometry';

const sphereGeometry = new THREE.SphereGeometry(0.4, 8, 8);

export function drawMarker(color: string, pt: IPoint2D, parent: THREE.Object3D): void {
    const material = new THREE.MeshBasicMaterial({ color, depthTest: false });
    const marker = new THREE.Mesh(sphereGeometry, material);
    marker.position.set(pt.x, DEBUG_LINE_Y, pt.z);
    marker.renderOrder = 1001;
    parent.add(marker);
}

const DEBUG_LINE_Y = 0.01;


export function drawSegment(color: string, seg: ISegment, parent: THREE.Object3D): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(seg.entry.x, seg.entry.y ?? DEBUG_LINE_Y, seg.entry.z),
        new THREE.Vector3(seg.exit.x, seg.exit.y ?? DEBUG_LINE_Y, seg.exit.z),
    ]);
    const material = new THREE.LineBasicMaterial({
        color,
        depthTest: false,
        transparent: true,
        opacity: 0.95,
    });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 2000;
    parent.add(line);
}

export function drawArrow(color: string, seg: ISegment, parent: THREE.Object3D): void {
    drawSegment(color, seg, parent);
    const cone = new THREE.ConeGeometry(0.1, 0.3, 8);
    const material = new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        transparent: true,
        opacity: 0.95,
    });
    const vec = Segment.direction(seg);
    const mesh = new THREE.Mesh(cone, material);
    const angle = Math.atan2(vec.z, vec.x);
    mesh.rotation.y = -angle;
    mesh.position.set(seg.exit.x, DEBUG_LINE_Y, seg.exit.z);
    mesh.renderOrder = 2001;
    parent.add(mesh);
}

export function drawArc(color: string, arc: IArc, parent: THREE.Object3D, y: number = DEBUG_LINE_Y): void {
    if (!Number.isFinite(arc.radius) || arc.radius <= EPSILON || Math.abs(arc.sweepAngle) <= EPSILON) {
        return;
    }

    const arcLength = arc.radius * Math.abs(arc.sweepAngle);
    const steps = Math.max(8, Math.ceil(arcLength / 1.5));
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = arc.startAngle + arc.sweepAngle * t;
        points.push(new THREE.Vector3(
            arc.center.x + Math.cos(angle) * arc.radius,
            y,
            arc.center.z + Math.sin(angle) * arc.radius,
        ));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color,
        depthTest: false,
        transparent: true,
        opacity: 0.95,
    });

    const line = new THREE.Line(geometry, material);
    line.renderOrder = 2000;
    parent.add(line);
}
