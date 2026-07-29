export const FIELD_W = 360;
export const FIELD_H = 520;
export const ROUND_SECONDS = 45;

const FIXED_STEP = 1 / 120;
const SHOT_INTERVAL = 0.11;
const BULLET_SPEED = 520;
const RECOIL_IMPULSE = 42;
const SHIP_MAX_SPEED = 210;
const AIM_DISTANCE = 92;
const BLOOM_LIFE = 8;
const BLOOM_LIMIT = 12;

function createRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function clampMagnitude(body, max) {
  const speed = Math.hypot(body.vx, body.vy);
  if (speed <= max || speed === 0) return;
  const scale = max / speed;
  body.vx *= scale;
  body.vy *= scale;
}

function wrap(body, margin = 0) {
  if (body.x < -margin) body.x = FIELD_W + margin;
  if (body.x > FIELD_W + margin) body.x = -margin;
  if (body.y < -margin) body.y = FIELD_H + margin;
  if (body.y > FIELD_H + margin) body.y = -margin;
}

export class SplatterdriftEngine {
  constructor(seed = 90317) {
    this.seed = seed;
    this.reset(seed);
  }

  reset(seed = this.seed) {
    const random = createRandom(seed);
    this.random = random;
    this.phase = "ready";
    this.elapsed = 0;
    this.accumulator = 0;
    this.lives = 3;
    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.lastHitAt = -999;
    this.shotsSinceHit = 0;
    this.held = false;
    this.shotCooldown = 0;
    this.invulnerable = 0;
    this.nextId = 1;
    this.hue = Math.floor(random() * 360);
    this.aimMode = "direction";
    this.aimDirectionX = 0;
    this.aimDirectionY = -1;
    this.aimX = FIELD_W / 2;
    this.aimY = FIELD_H / 2 - AIM_DISTANCE;
    this.ship = {
      x: FIELD_W / 2,
      y: FIELD_H / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
    };
    this.bullets = [];
    this.blooms = [];
    this.events = [];
    this.metrics = {
      shots: 0,
      hits: 0,
      destroyed: 0,
      collisions: 0,
      brakeEvents: 0,
    };
    this.asteroids = Array.from({ length: 6 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 6 + random() * 0.26;
      const distance = 136 + random() * 18;
      const speed = 28 + random() * 26;
      const drift = angle + Math.PI / 2 + (random() - 0.5) * 0.84;
      return {
        id: this.nextId++,
        x: FIELD_W / 2 + Math.cos(angle) * distance,
        y: FIELD_H / 2 + Math.sin(angle) * distance,
        vx: Math.cos(drift) * speed,
        vy: Math.sin(drift) * speed,
        radius: 24,
        tier: 2,
        rotation: random() * Math.PI * 2,
        spin: (random() - 0.5) * 0.9,
        shape: index % 4,
      };
    });
  }

  setAimPoint(x, y) {
    this.aimMode = "point";
    this.aimX = Math.max(0, Math.min(FIELD_W, x));
    this.aimY = Math.max(0, Math.min(FIELD_H, y));
    this.ship.angle = Math.atan2(this.aimY - this.ship.y, this.aimX - this.ship.x);
  }

  setAimDirection(dx, dy) {
    const length = Math.hypot(dx, dy);
    if (length < 0.001) return false;
    this.aimMode = "direction";
    this.aimDirectionX = dx / length;
    this.aimDirectionY = dy / length;
    this.syncDirectionAim();
    return true;
  }

  rotateAim(delta) {
    const angle = Math.atan2(this.aimDirectionY, this.aimDirectionX) + delta;
    this.setAimDirection(Math.cos(angle), Math.sin(angle));
  }

  pointerDownPoint(x, y) {
    this.setAimPoint(x, y);
    this.beginFiring();
  }

  pointerDownDirection(dx, dy) {
    if (!this.setAimDirection(dx, dy)) return;
    this.beginFiring();
  }

  beginFiring() {
    if (this.phase === "ready") {
      this.phase = "playing";
      this.events.push({ type: "start" });
    }
    if (this.phase !== "playing") return;
    this.held = true;
    this.fire();
    this.shotCooldown = SHOT_INTERVAL;
  }

  pointerUp() {
    this.held = false;
  }

  fire() {
    let nx = this.aimDirectionX;
    let ny = this.aimDirectionY;
    if (this.aimMode === "point") {
      const dx = this.aimX - this.ship.x;
      const dy = this.aimY - this.ship.y;
      const length = Math.hypot(dx, dy);
      if (length < 4) return;
      nx = dx / length;
      ny = dy / length;
      this.aimDirectionX = nx;
      this.aimDirectionY = ny;
    }
    const colorHue = this.hue;
    this.bullets.push({
      id: this.nextId++,
      x: this.ship.x + nx * 16,
      y: this.ship.y + ny * 16,
      vx: nx * BULLET_SPEED + this.ship.vx * 0.18,
      vy: ny * BULLET_SPEED + this.ship.vy * 0.18,
      life: 1.35,
      angle: Math.atan2(ny, nx),
      hue: colorHue,
    });
    this.ship.vx -= nx * RECOIL_IMPULSE;
    this.ship.vy -= ny * RECOIL_IMPULSE;
    clampMagnitude(this.ship, SHIP_MAX_SPEED);
    this.metrics.shots += 1;
    this.shotsSinceHit += 1;
    if (this.shotsSinceHit >= 6) this.combo = 1;
    this.events.push({ type: "shot", x: this.ship.x, y: this.ship.y, hue: colorHue });
  }

  advance(delta) {
    if (this.phase !== "playing") return;
    this.accumulator += Math.min(delta, 0.05);
    while (this.accumulator >= FIXED_STEP && this.phase === "playing") {
      this.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
  }

  step(dt) {
    this.elapsed += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.shotCooldown -= dt;
    if (this.held && this.shotCooldown <= 0) {
      this.fire();
      this.shotCooldown += SHOT_INTERVAL;
    }
    if (this.elapsed - this.lastHitAt > 2) this.combo = 1;

    const damping = Math.exp(-0.2 * dt);
    this.ship.vx *= damping;
    this.ship.vy *= damping;
    this.ship.x += this.ship.vx * dt;
    this.ship.y += this.ship.vy * dt;
    wrap(this.ship, 10);
    if (this.aimMode === "direction") this.syncDirectionAim();
    else this.ship.angle = Math.atan2(this.aimY - this.ship.y, this.aimX - this.ship.x);

    for (const asteroid of this.asteroids) {
      asteroid.x += asteroid.vx * dt;
      asteroid.y += asteroid.vy * dt;
      asteroid.rotation += asteroid.spin * dt;
      wrap(asteroid, asteroid.radius);
    }

    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      wrap(bullet, 3);
    }

    const expired = this.bullets.filter((bullet) => bullet.life <= 0);
    for (const bullet of expired) {
      this.events.push({ type: "expire", x: bullet.x, y: bullet.y, hue: bullet.hue });
    }
    this.bullets = this.bullets.filter((bullet) => bullet.life > 0);

    this.resolveBulletHits();
    this.resolveBloomCollect();
    this.resolveShipHits();
    this.updateBlooms(dt);

    if (this.asteroids.length === 0) this.finish("won");
    else if (this.elapsed >= ROUND_SECONDS) {
      this.elapsed = ROUND_SECONDS;
      this.finish("time");
    }
  }

  resolveBulletHits() {
    const deadBullets = new Set();
    const deadAsteroids = new Set();
    const spawned = [];
    for (const bullet of this.bullets) {
      for (const asteroid of this.asteroids) {
        if (deadAsteroids.has(asteroid.id)) continue;
        if (Math.hypot(bullet.x - asteroid.x, bullet.y - asteroid.y) > asteroid.radius + 3) continue;
        deadBullets.add(bullet.id);
        deadAsteroids.add(asteroid.id);
        this.metrics.hits += 1;
        this.metrics.destroyed += 1;
        this.shotsSinceHit = 0;
        this.combo = this.elapsed - this.lastHitAt <= 2 ? Math.min(4, this.combo + 1) : 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.lastHitAt = this.elapsed;
        const base = asteroid.tier === 2 ? 120 : 220;
        this.score += base * this.combo;
        this.hue = (this.hue + 47) % 360;
        const bloom = {
          id: this.nextId++,
          x: bullet.x,
          y: bullet.y,
          life: BLOOM_LIFE,
          radius: 19,
          hue: bullet.hue,
        };
        this.blooms.push(bloom);
        while (this.blooms.length > BLOOM_LIMIT) this.blooms.shift();
        this.events.push({
          type: "hit",
          x: bullet.x,
          y: bullet.y,
          hue: bullet.hue,
          tier: asteroid.tier,
          combo: this.combo,
          bloomId: bloom.id,
        });
        if (asteroid.tier === 2) {
          const baseAngle = Math.atan2(asteroid.vy, asteroid.vx);
          for (const sign of [-1, 1]) {
            const angle = baseAngle + sign * 0.78;
            spawned.push({
              id: this.nextId++,
              x: asteroid.x + Math.cos(angle) * 12,
              y: asteroid.y + Math.sin(angle) * 12,
              vx: Math.cos(angle) * 76,
              vy: Math.sin(angle) * 76,
              radius: 13,
              tier: 1,
              rotation: asteroid.rotation + sign * 0.4,
              spin: sign * 0.72,
              shape: (asteroid.shape + (sign > 0 ? 1 : 3)) % 4,
            });
          }
        }
        break;
      }
    }
    this.bullets = this.bullets.filter((bullet) => !deadBullets.has(bullet.id));
    this.asteroids = this.asteroids.filter((asteroid) => !deadAsteroids.has(asteroid.id)).concat(spawned);
  }

  resolveBloomCollect() {
    const collected = [];
    for (const bloom of this.blooms) {
      if (Math.hypot(this.ship.x - bloom.x, this.ship.y - bloom.y) > bloom.radius + 10) continue;
      collected.push(bloom.id);
      this.ship.vx *= 0.48;
      this.ship.vy *= 0.48;
      this.score += 75 * this.combo;
      this.metrics.brakeEvents += 1;
      this.lastHitAt += 0.6;
      this.events.push({ type: "brake", x: bloom.x, y: bloom.y, hue: bloom.hue, bloomId: bloom.id });
    }
    if (collected.length) this.blooms = this.blooms.filter((bloom) => !collected.includes(bloom.id));
  }

  resolveShipHits() {
    if (this.invulnerable > 0) return;
    for (const asteroid of this.asteroids) {
      if (Math.hypot(this.ship.x - asteroid.x, this.ship.y - asteroid.y) > asteroid.radius + 10) continue;
      this.lives -= 1;
      this.combo = 1;
      this.metrics.collisions += 1;
      this.invulnerable = 1.15;
      this.ship.x = FIELD_W / 2;
      this.ship.y = FIELD_H / 2;
      this.ship.vx = 0;
      this.ship.vy = 0;
      this.events.push({ type: "collision", lives: this.lives });
      if (this.lives <= 0) this.finish("failed");
      return;
    }
  }

  updateBlooms(dt) {
    for (const bloom of this.blooms) bloom.life -= dt;
    this.blooms = this.blooms.filter((bloom) => bloom.life > 0);
  }

  syncDirectionAim() {
    this.aimX = this.ship.x + this.aimDirectionX * AIM_DISTANCE;
    this.aimY = this.ship.y + this.aimDirectionY * AIM_DISTANCE;
    this.ship.angle = Math.atan2(this.aimDirectionY, this.aimDirectionX);
  }

  finish(phase) {
    if (this.phase === "won" || this.phase === "failed" || this.phase === "time") return;
    this.phase = phase;
    this.held = false;
    this.events.push({ type: "finish", phase });
  }

  consumeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  get timeLeft() {
    return Math.max(0, ROUND_SECONDS - this.elapsed);
  }

  get accuracy() {
    return this.metrics.shots === 0 ? 0 : this.metrics.hits / this.metrics.shots;
  }
}
