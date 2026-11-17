# aica-gta6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/yudi04cod/aica-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/yudi04cod/aica-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solano Nights: an original 3D open-world crime game set in the fictional city of Port
Solano. Explore the city on foot and by car through streets filled with traffic and
pedestrians, steal and drive cars, and watch the wanted level rise as police respond to
your crimes. Take on missions and follow the story, fight on foot and behind the wheel,
and track it all on a HUD with a live minimap. A start screen and save system round out
the experience. Every model, texture and sound is made in code for this game — original
work, with no assets from any commercial game.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in a desktop browser
```

No build step: `serve.ts` (Node 22, standard library only) serves the static `game/` folder,
whose ES modules are the whole game. Any static file server pointed at `game/` works just as
well.

The hand-in program is `main.ts`: `MAKEFUN_OUTPUT_DIR=out node main.ts` copies `game/` and
`screenshots/` to `out/` and writes the `dossier.json` the judge reads.

---

<sub>Entered on [make.fun](https://make.fun/?ref=38m33ybw&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
