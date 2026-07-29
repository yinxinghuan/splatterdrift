import assert from "node:assert/strict";
import { SplatterdriftEngine, ROUND_SECONDS } from "../src/engine.js";

function advanceFor(engine, seconds, fps) {
  const frames = Math.round(seconds * fps);
  for (let index = 0; index < frames; index += 1) engine.advance(1 / fps);
}

const recoil = new SplatterdriftEngine(31);
recoil.pointerDownDirection(1, 0);
assert.equal(recoil.phase, "playing");
assert.equal(recoil.metrics.shots, 1);
assert.ok(recoil.ship.vx < 0, "rightward fire must push the ship left");
advanceFor(recoil, 0.5, 60);
assert.ok(Math.abs(recoil.aimDirectionX - 1) < 0.001);
assert.ok(Math.abs(recoil.aimX - recoil.ship.x - 92) < 0.001);
recoil.pointerUp();

const split = new SplatterdriftEngine(42);
split.asteroids = [{
  id: 700,
  x: 260,
  y: 260,
  vx: 0,
  vy: 0,
  radius: 24,
  tier: 2,
  rotation: 0,
  spin: 0,
  shape: 0,
}];
split.ship.x = 180;
split.ship.y = 260;
split.pointerDownDirection(1, 0);
split.pointerUp();
advanceFor(split, 0.3, 60);
assert.equal(split.metrics.hits, 1);
assert.equal(split.asteroids.length, 2, "large asteroid must split into two");
assert.equal(split.blooms.length, 1, "a hit must create one brake bloom");

const brake = new SplatterdriftEngine(53);
brake.phase = "playing";
brake.ship.vx = 100;
brake.ship.vy = 0;
brake.asteroids = [{
  id: 701,
  x: 20,
  y: 20,
  vx: 0,
  vy: 0,
  radius: 13,
  tier: 1,
  rotation: 0,
  spin: 0,
  shape: 1,
}];
brake.blooms = [{
  id: 702,
  x: brake.ship.x + 8,
  y: brake.ship.y,
  radius: 19,
  life: 8,
  hue: 120,
}];
const scoreBeforeBrake = brake.score;
brake.advance(1 / 120);
assert.equal(brake.blooms.length, 0);
assert.ok(brake.ship.vx < 50, "collecting a bloom must cut speed by at least 52%");
assert.equal(brake.metrics.brakeEvents, 1);
assert.ok(brake.score > scoreBeforeBrake);

const collision = new SplatterdriftEngine(64);
collision.phase = "playing";
collision.asteroids = [{
  id: 703,
  x: collision.ship.x,
  y: collision.ship.y,
  vx: 0,
  vy: 0,
  radius: 24,
  tier: 2,
  rotation: 0,
  spin: 0,
  shape: 2,
}];
collision.advance(1 / 60);
assert.equal(collision.lives, 2);
assert.equal(collision.metrics.collisions, 1);

const coreBase = new SplatterdriftEngine(65);
coreBase.pointerDownDirection(1, 0);
const baseRecoil = Math.abs(coreBase.ship.vx);
assert.equal(coreBase.bullets.length, 1);

const coreFour = new SplatterdriftEngine(66);
coreFour.combo = 4;
coreFour.pointerDownDirection(1, 0);
assert.equal(coreFour.bullets.length, 2, "CORE x4 must emit a narrow twin shot");
assert.ok(Math.abs(coreFour.ship.vx) > baseRecoil, "CORE growth must increase recoil risk");
assert.ok(coreFour.bullets.every((bullet) => bullet.radius === 4.4));
assert.ok(coreFour.bullets[0].angle < coreFour.bullets[1].angle);

const pierce = new SplatterdriftEngine(67);
pierce.combo = 3;
pierce.ship.x = 100;
pierce.ship.y = 260;
pierce.asteroids = [180, 245].map((x, index) => ({
  id: 720 + index,
  x,
  y: 260,
  vx: 0,
  vy: 0,
  radius: 13,
  tier: 1,
  rotation: 0,
  spin: 0,
  shape: index,
}));
pierce.pointerDownDirection(1, 0);
pierce.pointerUp();
advanceFor(pierce, 0.38, 60);
assert.equal(pierce.metrics.hits, 2, "CORE x3 focused shot must pierce one extra target");

const waves = new SplatterdriftEngine(68);
waves.phase = "playing";
waves.asteroids = [];
waves.advance(1 / 120);
assert.equal(waves.metrics.wavesCleared, 1);
assert.equal(waves.wave, 2);
assert.equal(waves.asteroids.length, 0);
assert.ok(waves.waveDelay > 0);
advanceFor(waves, 0.7, 120);
assert.equal(waves.asteroids.length, 5, "wave two must add one large asteroid");
assert.equal(waves.betweenWaves, false);

const engine60 = new SplatterdriftEngine(75);
const engine30 = new SplatterdriftEngine(75);
engine60.pointerDownDirection(0.8, -0.2);
engine30.pointerDownDirection(0.8, -0.2);
advanceFor(engine60, 2, 60);
advanceFor(engine30, 2, 30);
assert.ok(Math.abs(engine60.ship.x - engine30.ship.x) < 0.05);
assert.ok(Math.abs(engine60.ship.y - engine30.ship.y) < 0.05);
assert.equal(engine60.asteroids.length, engine30.asteroids.length);
assert.equal(engine60.metrics.shots, engine30.metrics.shots);

const timer = new SplatterdriftEngine(86);
timer.phase = "playing";
timer.asteroids = [{
  id: 704,
  x: 20,
  y: 20,
  vx: 0,
  vy: 0,
  radius: 13,
  tier: 1,
  rotation: 0,
  spin: 0,
  shape: 3,
}];
advanceFor(timer, ROUND_SECONDS + 0.1, 30);
assert.equal(timer.phase, "time");

console.log("splatterdrift engine verification passed");
console.log({
  recoilVx: recoil.ship.vx,
  splitTargets: split.asteroids.length,
  bloomBrakeVx: brake.ship.vx,
  coreFourProjectiles: coreFour.bullets.length,
  piercingHits: pierce.metrics.hits,
  waveTwoTargets: waves.asteroids.length,
  deterministicShots: engine60.metrics.shots,
});
