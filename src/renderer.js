const FIELD_W = 360;
const FIELD_H = 520;
const GRAPHITE = "#11161a";
const WARM_WHITE = "#e8ece9";
const QUIET_WHITE = "rgba(232,236,233,0.42)";
const ION_CYAN = "#78d7e5";
const ION_WHITE = "#d8fbff";
const DANGER = "#ff746c";

const ASTEROID_SHAPES = [
  [[0.50, 0.03], [0.82, 0.15], [0.98, 0.43], [0.88, 0.78], [0.61, 0.98], [0.25, 0.89], [0.04, 0.60], [0.12, 0.25]],
  [[0.45, 0.02], [0.78, 0.10], [0.96, 0.34], [0.92, 0.68], [0.70, 0.96], [0.33, 0.92], [0.07, 0.70], [0.03, 0.34], [0.23, 0.12]],
  [[0.52, 0.04], [0.86, 0.22], [0.96, 0.54], [0.78, 0.88], [0.43, 0.98], [0.14, 0.82], [0.03, 0.46], [0.20, 0.16]],
  [[0.48, 0.02], [0.76, 0.08], [0.97, 0.38], [0.85, 0.72], [0.58, 0.97], [0.24, 0.90], [0.04, 0.63], [0.10, 0.29]],
];

function seededValue(value) {
  const x = Math.sin(value * 91.731 + 17.113) * 43758.5453;
  return x - Math.floor(x);
}

export class CanvasRenderer {
  constructor(canvas, engine, options = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!this.context) throw new Error("Canvas 2D is unavailable");
    this.engine = engine;
    this.reduced = Boolean(options.reduced);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.reduced ? 1.15 : 1.5);
    this.particleLimit = this.reduced ? 220 : 420;
    this.particles = [];
    this.pool = [];
    this.trail = [];
    this.trailClock = 0;
    this.waves = [];
    this.time = 0;
    this.muzzleFlash = 0;
    this.brakePulse = 0;
    this.collisionPulse = 0;
    this.ambient = Array.from({ length: this.reduced ? 16 : 28 }, (_, index) => ({
      x: seededValue(index + 1) * FIELD_W,
      y: seededValue(index + 31) * FIELD_H,
      size: 0.35 + seededValue(index + 71) * 0.75,
      alpha: 0.06 + seededValue(index + 101) * 0.08,
    }));
    this.resize();
  }

  resize() {
    const width = Math.round(FIELD_W * this.dpr);
    const height = Math.round(FIELD_H * this.dpr);
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.context.imageSmoothingEnabled = true;
  }

  reset() {
    this.pool.push(...this.particles);
    this.particles = [];
    this.trail = [];
    this.waves = [];
    this.time = 0;
    this.muzzleFlash = 0;
    this.brakePulse = 0;
    this.collisionPulse = 0;
  }

  process(events) {
    for (const event of events) {
      if (event.type === "shot") this.spawnShot(event);
      if (event.type === "hit") this.spawnHit(event);
      if (event.type === "expire") this.spawnExpire(event);
      if (event.type === "brake") this.spawnBrake(event);
      if (event.type === "collision") this.spawnCollision();
    }
  }

  acquire(config) {
    const particle = this.pool.pop() || {};
    Object.assign(particle, config);
    particle.maxLife = config.life;
    this.particles.push(particle);
    while (this.particles.length > this.particleLimit) {
      this.pool.push(this.particles.shift());
    }
    return particle;
  }

  spawnShot(event) {
    const sparkCount = this.reduced ? 2 : 4;
    const pressureCount = this.reduced ? 4 : 7;
    for (let index = 0; index < sparkCount; index += 1) {
      const tangent = (Math.random() - 0.5) * 0.36;
      this.acquire({
        kind: "spark",
        x: event.x + event.nx * 13,
        y: event.y + event.ny * 13,
        vx: event.nx * (115 + Math.random() * 90) - event.ny * tangent * 90,
        vy: event.ny * (115 + Math.random() * 90) + event.nx * tangent * 90,
        life: 0.12 + Math.random() * 0.12,
        size: 0.7 + Math.random() * 0.8,
        drag: 8,
        rotation: 0,
        spin: 0,
      });
    }
    for (let index = 0; index < pressureCount; index += 1) {
      const spread = (Math.random() - 0.5) * 0.72;
      this.acquire({
        kind: "dust",
        x: event.x - event.nx * 10,
        y: event.y - event.ny * 10,
        vx: -event.nx * (28 + Math.random() * 54) - event.ny * spread * 45,
        vy: -event.ny * (28 + Math.random() * 54) + event.nx * spread * 45,
        life: 0.24 + Math.random() * 0.28,
        size: 1.3 + Math.random() * 2.1,
        drag: 5.8,
        rotation: 0,
        spin: 0,
      });
    }
    this.muzzleFlash = 0.09;
    this.waves.push({ x: event.x, y: event.y, life: 0.18, maxLife: 0.18, radius: 8, color: ION_CYAN });
  }

  spawnHit(event) {
    const sparkCount = this.reduced ? (event.tier === 2 ? 9 : 7) : (event.tier === 2 ? 17 : 13);
    const dustCount = this.reduced ? 6 : 11;
    const shardCount = this.reduced ? 3 : 5;
    for (let index = 0; index < sparkCount; index += 1) {
      const angle = Math.atan2(event.ny, event.nx) + (Math.random() - 0.5) * 2.25;
      const speed = 80 + Math.random() * 155;
      this.acquire({
        kind: "spark",
        x: event.x,
        y: event.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.22 + Math.random() * 0.34,
        size: 0.8 + Math.random() * 1.25,
        drag: 3.6,
        rotation: angle,
        spin: 0,
      });
    }
    for (let index = 0; index < dustCount; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 24 + Math.random() * 72;
      this.acquire({
        kind: "dust",
        x: event.x,
        y: event.y,
        vx: Math.cos(angle) * speed + event.nx * 28,
        vy: Math.sin(angle) * speed + event.ny * 28,
        life: 0.48 + Math.random() * 0.48,
        size: 1.6 + Math.random() * 3,
        drag: 3.2,
        rotation: angle,
        spin: 0,
      });
    }
    for (let index = 0; index < shardCount; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 38 + Math.random() * 76;
      this.acquire({
        kind: "shard",
        x: event.x,
        y: event.y,
        vx: Math.cos(angle) * speed + event.nx * 30,
        vy: Math.sin(angle) * speed + event.ny * 30,
        life: 0.38 + Math.random() * 0.4,
        size: 2.2 + Math.random() * 2.6,
        drag: 2.8,
        rotation: angle,
        spin: (Math.random() - 0.5) * 9,
      });
    }
    this.waves.push({
      x: event.x,
      y: event.y,
      life: 0.32,
      maxLife: 0.32,
      radius: event.tier === 2 ? 13 : 9,
      color: ION_CYAN,
    });
  }

  spawnExpire(event) {
    const count = this.reduced ? 3 : 6;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 12 + Math.random() * 30;
      this.acquire({
        kind: "dust",
        x: event.x,
        y: event.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.22 + Math.random() * 0.24,
        size: 1 + Math.random() * 1.4,
        drag: 5,
        rotation: angle,
        spin: 0,
      });
    }
  }

  spawnBrake(event) {
    const count = this.reduced ? 13 : 23;
    const targetX = this.engine.ship.x;
    const targetY = this.engine.ship.y;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.16;
      const radius = 9 + Math.random() * 17;
      const x = event.x + Math.cos(angle) * radius;
      const y = event.y + Math.sin(angle) * radius;
      this.acquire({
        kind: "collapse",
        x,
        y,
        vx: (targetX - x) * (5.2 + Math.random() * 2.4),
        vy: (targetY - y) * (5.2 + Math.random() * 2.4),
        life: 0.18 + Math.random() * 0.08,
        size: 1 + Math.random() * 1.5,
        drag: 1.2,
        rotation: angle,
        spin: 0,
      });
    }
    this.brakePulse = 0.22;
    this.waves.push({ x: targetX, y: targetY, life: 0.28, maxLife: 0.28, radius: 10, color: ION_WHITE });
  }

  spawnCollision() {
    const count = this.reduced ? 8 : 15;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.22;
      const speed = 55 + Math.random() * 95;
      this.acquire({
        kind: "danger",
        x: this.engine.ship.x,
        y: this.engine.ship.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.26 + Math.random() * 0.22,
        size: 1 + Math.random() * 1.6,
        drag: 4,
        rotation: angle,
        spin: 0,
      });
    }
    this.collisionPulse = 0.32;
  }

  updateParticles(delta) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= delta;
      if (particle.life <= 0) {
        this.pool.push(particle);
        this.particles.splice(index, 1);
        continue;
      }
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      const damping = Math.exp(-particle.drag * delta);
      particle.vx *= damping;
      particle.vy *= damping;
      particle.rotation += particle.spin * delta;
    }
    for (let index = this.waves.length - 1; index >= 0; index -= 1) {
      this.waves[index].life -= delta;
      if (this.waves[index].life <= 0) this.waves.splice(index, 1);
    }
  }

  updateTrail(delta) {
    this.trailClock += delta;
    const ship = this.engine.ship;
    const previous = this.trail.at(-1);
    const distance = previous ? Math.hypot(ship.x - previous.x, ship.y - previous.y) : 999;
    const wrapped = previous && distance > 90;
    if (!previous || distance > 0.7 || this.trailClock > 0.06) {
      this.trail.push({ x: ship.x, y: ship.y, break: Boolean(wrapped) });
      this.trailClock = 0;
    }
    const limit = this.reduced ? 18 : 28;
    while (this.trail.length > limit) this.trail.shift();
  }

  sync(delta) {
    this.time += delta;
    this.muzzleFlash = Math.max(0, this.muzzleFlash - delta);
    this.brakePulse = Math.max(0, this.brakePulse - delta);
    this.collisionPulse = Math.max(0, this.collisionPulse - delta);
    this.updateParticles(delta);
    this.updateTrail(delta);
    this.draw();
  }

  draw() {
    const context = this.context;
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.clearRect(0, 0, FIELD_W, FIELD_H);
    this.drawAmbient(context);
    this.drawTrail(context);
    this.drawBlooms(context);
    this.drawAsteroids(context);
    this.drawBullets(context);
    this.drawParticles(context);
    this.drawWaves(context);
    this.drawAim(context);
    this.drawShip(context);
  }

  drawAmbient(context) {
    context.save();
    context.fillStyle = WARM_WHITE;
    for (const point of this.ambient) {
      context.globalAlpha = point.alpha;
      context.fillRect(point.x, point.y, point.size, point.size);
    }
    context.restore();
  }

  drawTrail(context) {
    if (this.trail.length < 2) return;
    const speed = Math.hypot(this.engine.ship.vx, this.engine.ship.vy);
    const speedFactor = Math.min(1, speed / 170);
    context.save();
    context.globalCompositeOperation = "lighter";
    for (let index = 1; index < this.trail.length; index += 1) {
      const current = this.trail[index];
      const previous = this.trail[index - 1];
      if (current.break) continue;
      const age = index / this.trail.length;
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(current.x, current.y);
      context.strokeStyle = `rgba(120,215,229,${0.025 + age * (0.11 + speedFactor * 0.17)})`;
      context.lineWidth = 0.5 + age * (1.2 + speedFactor * 1.7);
      context.lineCap = "round";
      context.stroke();
    }
    context.restore();
  }

  drawBlooms(context) {
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const bloom of this.engine.blooms) {
      const fade = Math.min(1, bloom.life / 0.7);
      const count = this.reduced ? 12 : 20;
      for (let index = 0; index < count; index += 1) {
        const direction = index % 2 ? 1 : -1;
        const speed = 0.55 + (index % 5) * 0.09;
        const angle = seededValue(bloom.id * 7 + index) * Math.PI * 2
          + this.time * speed * direction;
        const radius = 7 + (index % 6) * 2.35 + Math.sin(this.time * 2.1 + index) * 1.4;
        const x = bloom.x + Math.cos(angle) * radius;
        const y = bloom.y + Math.sin(angle) * radius;
        const length = 2.5 + (index % 3) * 1.4;
        context.beginPath();
        context.moveTo(x - Math.sin(angle) * length, y + Math.cos(angle) * length);
        context.lineTo(x + Math.sin(angle) * length, y - Math.cos(angle) * length);
        context.strokeStyle = `rgba(120,215,229,${fade * (0.18 + (index % 4) * 0.045)})`;
        context.lineWidth = index % 5 === 0 ? 1.6 : 0.9;
        context.lineCap = "round";
        context.stroke();
      }
      context.beginPath();
      context.arc(bloom.x, bloom.y, 1.6, 0, Math.PI * 2);
      context.fillStyle = `rgba(216,251,255,${fade * 0.72})`;
      context.fill();
    }
    context.restore();
  }

  drawAsteroids(context) {
    for (const asteroid of this.engine.asteroids) {
      const shape = ASTEROID_SHAPES[asteroid.shape % ASTEROID_SHAPES.length];
      context.save();
      context.translate(asteroid.x, asteroid.y);
      context.rotate(asteroid.rotation);
      const size = asteroid.radius * 2;
      context.beginPath();
      shape.forEach(([px, py], index) => {
        const x = (px - 0.5) * size;
        const y = (py - 0.5) * size;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.fillStyle = GRAPHITE;
      context.fill();
      context.strokeStyle = asteroid.tier === 2 ? "rgba(232,236,233,0.84)" : "rgba(232,236,233,0.68)";
      context.lineWidth = asteroid.tier === 2 ? 1.7 : 1.25;
      if (asteroid.tier === 1) context.setLineDash([3, 2]);
      context.stroke();
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(-asteroid.radius * 0.24, -asteroid.radius * 0.16);
      context.lineTo(asteroid.radius * 0.28, asteroid.radius * 0.18);
      context.strokeStyle = QUIET_WHITE;
      context.lineWidth = 1.1;
      context.lineCap = "round";
      context.stroke();
      context.restore();
    }
  }

  drawBullets(context) {
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const bullet of this.engine.bullets) {
      const length = Math.max(1, Math.hypot(bullet.vx, bullet.vy));
      const nx = bullet.vx / length;
      const ny = bullet.vy / length;
      context.beginPath();
      context.moveTo(bullet.x - nx * 15, bullet.y - ny * 15);
      context.lineTo(bullet.x, bullet.y);
      context.strokeStyle = "rgba(120,215,229,0.2)";
      context.lineWidth = 3.2;
      context.lineCap = "round";
      context.stroke();
      context.beginPath();
      context.moveTo(bullet.x - nx * 9, bullet.y - ny * 9);
      context.lineTo(bullet.x, bullet.y);
      context.strokeStyle = ION_WHITE;
      context.lineWidth = 1.25;
      context.stroke();
    }
    context.restore();
  }

  drawParticles(context) {
    context.save();
    for (const particle of this.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      if (particle.kind === "spark" || particle.kind === "collapse") {
        context.globalCompositeOperation = "lighter";
        const speed = Math.max(1, Math.hypot(particle.vx, particle.vy));
        const nx = particle.vx / speed;
        const ny = particle.vy / speed;
        context.beginPath();
        context.moveTo(particle.x - nx * particle.size * 4.5, particle.y - ny * particle.size * 4.5);
        context.lineTo(particle.x, particle.y);
        context.strokeStyle = particle.kind === "collapse"
          ? `rgba(216,251,255,${alpha * 0.82})`
          : `rgba(120,215,229,${alpha * 0.9})`;
        context.lineWidth = particle.size;
        context.lineCap = "round";
        context.stroke();
      } else if (particle.kind === "shard") {
        context.globalCompositeOperation = "source-over";
        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.beginPath();
        context.moveTo(particle.size, 0);
        context.lineTo(-particle.size * 0.8, particle.size * 0.55);
        context.lineTo(-particle.size * 0.35, -particle.size * 0.72);
        context.closePath();
        context.fillStyle = `rgba(232,236,233,${alpha * 0.62})`;
        context.fill();
        context.restore();
      } else {
        context.globalCompositeOperation = particle.kind === "danger" ? "lighter" : "source-over";
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size * (0.45 + alpha * 0.55), 0, Math.PI * 2);
        const color = particle.kind === "danger" ? "255,116,108" : "120,215,229";
        context.fillStyle = `rgba(${color},${alpha * (particle.kind === "dust" ? 0.24 : 0.74)})`;
        context.fill();
      }
    }
    context.restore();
  }

  drawWaves(context) {
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const wave of this.waves) {
      const progress = 1 - wave.life / wave.maxLife;
      context.beginPath();
      context.arc(wave.x, wave.y, wave.radius + progress * 17, 0, Math.PI * 2);
      context.strokeStyle = wave.color === ION_WHITE
        ? `rgba(216,251,255,${(1 - progress) * 0.34})`
        : `rgba(120,215,229,${(1 - progress) * 0.28})`;
      context.lineWidth = 1.2;
      context.stroke();
    }
    context.restore();
  }

  drawAim(context) {
    const ship = this.engine.ship;
    const angle = Math.atan2(this.engine.aimDirectionY, this.engine.aimDirectionX);
    const endX = ship.x + Math.cos(angle) * 92;
    const endY = ship.y + Math.sin(angle) * 92;
    context.save();
    context.beginPath();
    context.moveTo(ship.x, ship.y);
    context.lineTo(endX, endY);
    context.setLineDash([2, 5]);
    context.strokeStyle = "rgba(232,236,233,0.24)";
    context.lineWidth = 0.9;
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.arc(endX, endY, 2.3, 0, Math.PI * 2);
    context.strokeStyle = "rgba(232,236,233,0.62)";
    context.stroke();
    context.restore();
  }

  drawShip(context) {
    const ship = this.engine.ship;
    const invulnerableHidden = this.engine.invulnerable > 0 && Math.floor(this.time * 12) % 2 === 0;
    if (invulnerableHidden) return;
    context.save();
    context.translate(ship.x, ship.y);
    context.rotate(ship.angle + Math.PI / 2);
    const brakeScale = this.brakePulse > 0 ? 0.86 + (this.brakePulse / 0.22) * 0.14 : 1;
    context.scale(1, brakeScale);
    context.beginPath();
    context.arc(0, 0, 11.5, 0, Math.PI * 2);
    context.fillStyle = GRAPHITE;
    context.fill();
    context.strokeStyle = this.collisionPulse > 0 ? DANGER : WARM_WHITE;
    context.lineWidth = 2.4;
    context.stroke();
    context.beginPath();
    context.moveTo(-3.5, -11);
    context.lineTo(0, -16);
    context.lineTo(3.5, -11);
    context.strokeStyle = WARM_WHITE;
    context.lineWidth = 1.6;
    context.stroke();
    context.beginPath();
    context.arc(0, 1.5, 5.1, 0.1, Math.PI - 0.1);
    context.strokeStyle = "rgba(120,215,229,0.76)";
    context.lineWidth = 1.35;
    context.stroke();
    if (this.muzzleFlash > 0 && !this.reduced) {
      context.globalCompositeOperation = "lighter";
      context.beginPath();
      context.moveTo(-2.2, -17);
      context.lineTo(0, -23 - this.muzzleFlash * 24);
      context.lineTo(2.2, -17);
      context.strokeStyle = `rgba(216,251,255,${this.muzzleFlash / 0.09})`;
      context.lineWidth = 1.1;
      context.stroke();
    }
    context.restore();
  }

  get particleCount() {
    return this.particles.length;
  }
}
