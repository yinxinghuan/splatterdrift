# SPLATTERDRIFT / 溅迹漂移

Visual mechanism adapted from **“css splatters (click for craze)”** by
[David Aerne (`meodai`)](https://codepen.io/meodai/pen/WNPKNzv), used under the
MIT License. See `public/THIRD_PARTY_NOTICES.txt`.

A 45-second touch-first Asteroids variant where firing is the only propulsion.
The product layer uses a pooled Canvas particle field: recoil draws the route,
directional hit debris exposes impact, and collectible particle vortices cut
momentum. The original DOM/CSS mechanism remains isolated at `?baseline=1`.

## Local development

```bash
npm install
npm run dev -- --host 127.0.0.1
```

- Product: `/`
- Mechanical visual baseline: `/?baseline=1`
- Engine verification: `npm run verify`

The game is a portable Vite project with `base: './'`.
