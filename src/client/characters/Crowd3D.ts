import { Population } from "./Population";

export type { CrowdOptions } from "./Population";

// Backward-compatible name. Prefer using Population directly.
export class Crowd3D extends Population {
	get population(): Population {
		return this;
	}
}
