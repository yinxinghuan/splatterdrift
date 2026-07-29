const ASTEROID_SHAPES = [
  "50,3 82,15 98,43 88,78 61,98 25,89 4,60 12,25",
  "45,2 78,10 96,34 92,68 70,96 33,92 7,70 3,34 23,12",
  "52,4 86,22 96,54 78,88 43,98 14,82 3,46 20,16",
  "48,2 76,8 97,38 85,72 58,97 24,90 4,63 10,29",
];

function colorForHue(hue) {
  return `oklch(82% 0.19 ${hue})`;
}

function setPosition(node, x, y, rotation = 0) {
  node.style.setProperty("--sd-x", `${x}px`);
  node.style.setProperty("--sd-y", `${y}px`);
  node.style.setProperty("--sd-r", `${rotation}rad`);
}

export class DomRenderer {
  constructor(world, engine, options = {}) {
    this.world = world;
    this.engine = engine;
    this.reduced = Boolean(options.reduced);
    this.objectLimit = this.reduced ? 90 : 160;
    this.asteroids = new Map();
    this.bullets = new Map();
    this.blooms = new Map();
    this.particles = [];
    this.ship = document.createElement("i");
    this.ship.className = "sd-ship";
    this.ship.innerHTML = "<span></span>";
    this.world.appendChild(this.ship);
    this.aim = document.createElement("i");
    this.aim.className = "sd-aim";
    this.aim.innerHTML = "<span></span>";
    this.world.appendChild(this.aim);
  }

  reset() {
    for (const map of [this.asteroids, this.bullets, this.blooms]) {
      for (const node of map.values()) node.remove();
      map.clear();
    }
    for (const particle of this.particles) particle.node.remove();
    this.particles = [];
    this.ship.className = "sd-ship";
  }

  process(events) {
    for (const event of events) {
      if (event.type === "shot") this.pulseShip();
      if (event.type === "hit") {
        this.spawnBurst(event, event.tier === 2
          ? (this.reduced ? [5, 7] : [10, 14])
          : (this.reduced ? [4, 6] : [8, 11]));
      }
      if (event.type === "expire") this.spawnBurst(event, this.reduced ? [2, 3] : [3, 5], true);
      if (event.type === "brake") this.collectBloom(event);
      if (event.type === "collision") this.collisionRing();
    }
  }

  pulseShip() {
    this.ship.classList.remove("is-firing");
    void this.ship.offsetWidth;
    this.ship.classList.add("is-firing");
  }

  collisionRing() {
    const ring = document.createElement("i");
    ring.className = "sd-impact-ring";
    setPosition(ring, this.engine.ship.x, this.engine.ship.y);
    this.world.appendChild(ring);
    window.setTimeout(() => ring.remove(), 240);
  }

  collectBloom(event) {
    const bloom = this.blooms.get(event.bloomId);
    if (bloom) {
      this.blooms.delete(event.bloomId);
      bloom.classList.add("is-collected");
      bloom.style.setProperty("--collect-x", `${this.engine.ship.x - event.x}px`);
      bloom.style.setProperty("--collect-y", `${this.engine.ship.y - event.y}px`);
      window.setTimeout(() => bloom.remove(), 190);
    }
    this.ship.classList.remove("is-braking");
    void this.ship.offsetWidth;
    this.ship.classList.add("is-braking");
  }

  spawnBurst(event, range, quiet = false) {
    const count = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
    for (let index = 0; index < count; index += 1) {
      const node = document.createElement("i");
      node.className = quiet ? "sd-ink sd-ink--quiet" : "sd-ink";
      const angle = Math.random() * Math.PI * 2;
      const speed = quiet ? 20 + Math.random() * 36 : 38 + Math.random() * 72;
      const particle = {
        node,
        x: event.x,
        y: event.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        moving: quiet ? 0.12 + Math.random() * 0.12 : 0.24 + Math.random() * 0.28,
        residue: quiet ? 0.65 : 1.2 + Math.random() * 0.8,
      };
      node.style.setProperty("--sd-color", colorForHue(event.hue));
      node.style.setProperty("--sd-scale", String(0.55 + Math.random() * (quiet ? 1.8 : 3.4)));
      setPosition(node, particle.x, particle.y, angle);
      this.world.appendChild(node);
      this.particles.push(particle);
    }
    while (this.particles.length > this.objectLimit) {
      this.particles.shift().node.remove();
    }
  }

  updateParticles(delta) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      if (particle.moving > 0) {
        particle.moving -= delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        const damping = Math.exp(-7.4 * delta);
        particle.vx *= damping;
        particle.vy *= damping;
        setPosition(particle.node, particle.x, particle.y);
        if (particle.moving <= 0) particle.node.classList.add("is-residue");
        continue;
      }
      particle.residue -= delta;
      if (particle.residue > 0) continue;
      particle.node.classList.add("is-fading");
      window.setTimeout(() => particle.node.remove(), 180);
      this.particles.splice(index, 1);
    }
  }

  sync(delta) {
    const { engine } = this;
    setPosition(this.ship, engine.ship.x, engine.ship.y, engine.ship.angle + Math.PI / 2);
    this.ship.classList.toggle("is-invulnerable", engine.invulnerable > 0);
    this.ship.style.setProperty("--sd-color", colorForHue(engine.hue));

    const directionAngle = Math.atan2(engine.aimDirectionY, engine.aimDirectionX);
    setPosition(this.aim, engine.ship.x, engine.ship.y, directionAngle);

    this.syncAsteroids();
    this.syncBullets();
    this.syncBlooms();
    this.updateParticles(delta);
  }

  syncAsteroids() {
    const live = new Set();
    for (const asteroid of this.engine.asteroids) {
      live.add(asteroid.id);
      let node = this.asteroids.get(asteroid.id);
      if (!node) {
        node = document.createElement("i");
        node.className = `sd-asteroid sd-asteroid--tier-${asteroid.tier}`;
        node.innerHTML = `
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <polygon points="${ASTEROID_SHAPES[asteroid.shape % ASTEROID_SHAPES.length]}"></polygon>
            <path d="M38 42 L62 58"></path>
          </svg>`;
        this.world.appendChild(node);
        this.asteroids.set(asteroid.id, node);
      }
      node.style.setProperty("--sd-size", `${asteroid.radius * 2}px`);
      setPosition(node, asteroid.x, asteroid.y, asteroid.rotation);
    }
    this.prune(this.asteroids, live);
  }

  syncBullets() {
    const live = new Set();
    for (const bullet of this.engine.bullets) {
      live.add(bullet.id);
      let node = this.bullets.get(bullet.id);
      if (!node) {
        node = document.createElement("i");
        node.className = "sd-projectile";
        this.world.appendChild(node);
        this.bullets.set(bullet.id, node);
      }
      node.style.setProperty("--sd-color", colorForHue(bullet.hue));
      setPosition(node, bullet.x, bullet.y, bullet.angle + Math.PI / 2);
    }
    this.prune(this.bullets, live);
  }

  syncBlooms() {
    const live = new Set();
    for (const bloom of this.engine.blooms) {
      live.add(bloom.id);
      let node = this.blooms.get(bloom.id);
      if (!node) {
        node = document.createElement("i");
        node.className = "sd-bloom";
        node.innerHTML = "<span></span><span></span><span></span>";
        this.world.appendChild(node);
        this.blooms.set(bloom.id, node);
      }
      node.style.setProperty("--sd-color", colorForHue(bloom.hue));
      node.style.setProperty("--sd-life", String(Math.max(0, bloom.life / 8)));
      setPosition(node, bloom.x, bloom.y);
    }
    this.prune(this.blooms, live);
  }

  prune(map, live) {
    for (const [id, node] of map) {
      if (live.has(id)) continue;
      node.remove();
      map.delete(id);
    }
  }
}
