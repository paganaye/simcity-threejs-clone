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

# Goals
I want to build a SimCity-style game designed around puzzle levels.

Each level presents a simple, unique objective.
You play with constraints, so you do not always have access to every tool.
For example, a level might ask you to build a crossroad or solve a city issue.
Early levels should be short, typically lasting from a few seconds to a couple of minutes.

Players can also create and share their own puzzles.

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


## Time
We got 4 seasons
    Sprint
    Summer
    Autumn
    Winter
Each Season has 7 days
     Mon 1 , Tue 2,  Wed 3, Thu 4, Fri 5, Sat 6, Sun 7
Each day has times of day


08:00 Morning :  
        Wake up
        Breakfast
        Going to work or not or somewhere else        
09:00 Morning Work
        or leasure or other
12:00 Lunch time
        Go to lunch or home
        Having Lunch
        Go back to work or not or somewere else
14:00 Afternoon Work
        or leasure or other
17:00 Going back home
    or not
19:00   Dinner
    or not a bit like lunch time
20:00 Evening time
        typically leasure
23:00 Night time

when there is not events the time can speed up



     
