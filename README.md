# simcity-threejs-clone

## What is this?

This is a fork of an ongoing project where @dgreenheck attempt to create a clone of SimCity using [Three.js](https://threejs.org/).

In this fork I @paganaye migrate the source to typescript + solid.js.

## How do I run this locally?

You will first need to install [Node.js](https://nodejs.org).

After that, clone this repository, navigate to the root directory and run the following command

```bash
npm run dev
```

## How did you make this?

Want to know how I made this? Follow the YouTube tutorial series [here](https://www.youtube.com/playlist?list=PLtzt35QOXmkJ9unmoeA5gXHcscQHJVQpW)

## I want to play with it!

Here you go!

https://dgreenheck.github.io/simcity-threejs-clone

## License

This code is covered by the MIT License. TLDR; you can do whatever you want with it!

## World Coordinates and Road Directions

World space follows Three.js conventions:
* Ground plane: XZ
* Vertical axis: Y
* Position unit: meters
* Orientation unit: radians (rotation around Y for heading)

For usability, non-mobile object placement is snapped to 1-meter coordinates on the ground plane:
* x = round(x)
* z = round(z)

Road orientation keeps a 16-direction model:
* 4 cardinal: N, S, E, W using (±1, 0) and (0, ±1)
* 4 diagonal: NE, NW, SE, SW using (±1, ±1)
* 8 intermediate using simple ratios (±2, ±1) and (±1, ±2)
