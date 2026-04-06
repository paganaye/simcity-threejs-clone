export type CharacterActivity =
  | "sleeping"
  | "home"
  | "commuting_to_work"
  | "working"
  | "commuting_home"
  | "shopping"
  | "leisure";

export interface INeedsDelta {
  hunger: number;
  energy: number;
  fun: number;
  social: number;
}

export interface IPoint2DDelta {
  x: number;
  z: number;
}

export interface ICharacterDelta {
  id: number;
  activity?: CharacterActivity;
  needs?: Partial<INeedsDelta>;
  location?: IPoint2DDelta | null;
}

export interface IHouseholdDelta {
  id: number;
  homeTile?: IPoint2DDelta | null;
  memberIds?: number[];
  carCount?: number;
}

export interface ICarPathDelta {
  x: number;
  z: number;
  speed?: number;
}

export interface ICarDelta {
  id: number;
  model?: string;
  path?: Partial<ICarPathDelta>[];
  motion?: "forward" | "loop";
  startTime?: number;
}

export interface ICityDelta {
  name: string;
  width: number;
  height: number;
  clear?: boolean;
}

export interface ISimulationDelta {
  cityChanged?: ICityDelta;
  carChanged?: ICarDelta[];
  characterChanged?: ICharacterDelta[];
  householdChanged?: IHouseholdDelta[];
}
