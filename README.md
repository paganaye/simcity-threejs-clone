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

## Road Grid System
We use a Square Grid
But for roads we allow 16-Directions
* 4 cardinal N, S, E, W  (±1,0) and (±1,0)
* 4 diagonal NE, NW, SE, SW  (±1,±1)
* 8 intermediate using simple ratios (±2,±1) and (±1,±2)
