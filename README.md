# SPLATTERDRIFT / 溅迹漂移

Visual mechanism adapted from **“css splatters (click for craze)”** by
[David Aerne (`meodai`)](https://codepen.io/meodai/pen/WNPKNzv), used under the
MIT License. See `public/THIRD_PARTY_NOTICES.txt`.

A 45-second touch-first Asteroids variant where firing is the only propulsion.
Consecutive hits upgrade the CORE from a stronger single shot to piercing and
twin-shot configurations; clearing a sector creates a brief breath before a
denser, faster wave. The product layer uses a pooled Canvas particle field:
recoil draws the route, directional hit debris exposes impact, and collectible
particle vortices cut momentum. The original DOM/CSS mechanism remains isolated
at `?baseline=1`.

AlterU sessions also receive a score leaderboard. Other players appear with
avatar and name and can open their Aigram profile; the current player is marked
as `YOU`. External visitors see an AlterU download entry instead of a false
platform identity.

## Local development

```bash
npm install
npm run dev -- --host 127.0.0.1
```

- Product: `/`
- Mechanical visual baseline: `/?baseline=1`
- Engine verification: `npm run verify`

The game is a portable Vite project with `base: './'`. Official poster
provenance is recorded in `_production/poster-source.json`.
