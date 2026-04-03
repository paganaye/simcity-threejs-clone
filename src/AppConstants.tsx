const DefaultCitySize = 5;

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
    TileSizeInMetre: 20,
    // Average adult height used by procedural characters.
    CharacterHeightInMetre: 1.75,
    // Crowd/traffic occupancy grid resolution inside one tile.
    PixelPerTile: 40,

    //carZOffset: 0.05

    STRAIGHT_SPEED: 1 / 1000,
    TURN_SPEED: 1 / 2000,
    U_TURN_SPEED: 1 / 4000,
    LANE_OFFSET: 0.05

}

