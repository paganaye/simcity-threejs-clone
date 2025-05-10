const DefaultCitySize = 50;

export var appConstants = {
    defaultCitySize: DefaultCitySize,
    DefaultCarCount: 1_000,
    AssetsBaseUrl: "./",
    // In order to relieve the Graphic card all mesh are used as MeshInstances.
    MeshInstancesMin: 8,
    MeshInstancesGrowth: 1.6,
    // This give the scale of every buildings
    TileSizeInMetre: 16,
    // this is used by cars so that no two car or people a    
    PixelPerTile: 16, // we can't have two things in a square meter.
}

