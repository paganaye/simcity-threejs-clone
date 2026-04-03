const DefaultCitySize = 80;

export var appConstants = {
    defaultCitySize: DefaultCitySize,
    DefaultCarCount: 3,
    AssetsBaseUrl: "./",
    // 1 world unit = 1 meter.
    WorldUnitInMetre: 1,
    // In order to relieve the Graphic card all mesh are used as MeshInstances.
    MeshInstancesMin: 8,
    MeshInstancesGrowth: 1.6,
    // City scale chosen for this project.
    BuildingsScale: 20,
    BuildingsMaxLength: 20,
    BuildingsFootprintMarginMetre: 1,
    // Asset pipeline normalization base for imported GLB dimensions.
    ModelNormalizationBase: 30,
    // Average adult height used by procedural characters.
    CharacterHeightInMetre: 1.75,
    ChildHeightInMetre: 1.0,

    //carZOffset: 0.05

    STRAIGHT_SPEED: 1 / 1000,
    TURN_SPEED: 1 / 2000,
    U_TURN_SPEED: 1 / 4000,
    LANE_OFFSET: 0.05

}

