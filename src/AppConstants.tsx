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
    // Recommended city-builder scale: one tile is 12m x 12m.
    TileSizeInMetre: 12,
    // Crowd/traffic occupancy grid resolution inside one tile.
    PixelPerTile: 12,

    //carZOffset: 0.05

    STRAIGHT_SPEED: 1 / 1000,
    TURN_SPEED: 1 / 2000,
    U_TURN_SPEED: 1 / 4000,
    LANE_OFFSET: 0.05

}

