export interface ISideCuts {
    from: number; // sidewalk start cut
    roadFrom: number;
    roadTo: number;
    to: number; // sidewalk end cut
}

export interface IExtremityCut {
    left: number;
    roadLeft: number;
    roadRight: number;
    right: number;
}

export interface IRoadCuts {
    rightCuts?: ISideCuts[];
    leftCuts?: ISideCuts[];
    startCut?: IExtremityCut;
    endCut?: IExtremityCut;
}