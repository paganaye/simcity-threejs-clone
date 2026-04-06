import { Accessor, Setter } from "solid-js";
import { createSignal } from "solid-js";

export class Signal<T> {
    get: Accessor<T>;
    set: Setter<T>;

    constructor(value: T) {
        [this.get, this.set] = createSignal<T>(value);
    }
}