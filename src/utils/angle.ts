import { DEG2RAD } from "three/src/math/MathUtils.js";


export function angle(angleInDegree: number) {
    return DEG2RAD * angleInDegree;
}
