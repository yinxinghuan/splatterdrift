export class RecoilSplatterField {
  constructor(root, options = {}) {
    this.root = root;
    this.options = {
      fireIntervalMs: 54,
      projectileSpeed: 25,
      recoilForce: 1.55,
      particleRange: [10, 30],
      particleSpeed: [2, 5],
      damping: 0.98,
      residueLimit: 280,
      colorForHue: (hue) => `lch(100 60 ${hue})`,
      onBoundaryHit: () => {},
      ...options,
    };
    this.player = this.makeObject("rsf-player", root.clientWidth / 2, root.clientHeight / 2);
    this.player.vx = 0;
    this.player.vy = 0;
    this.projectiles = [];
    this.particles = [];
    this.residue = [];
    this.hue = Math.random() * 360;
    this.pointerId = null;
    this.timer = 0;
    this.frame = 0;
    this.running = false;
    this.onMove = (event) => this.aim(event.clientX, event.clientY);
    this.onDown = (event) => this.pointerDown(event);
    this.onUp = (event) => this.pointerUp(event);
    this.onVisibility = () => { if (document.hidden) this.release(); };
  }

  makeObject(className, x, y, color = "#fff") {
    const element = document.createElement("i");
    element.className = `rsf-object ${className}`;
    this.root.appendChild(element);
    return { element, x, y, vx: 0, vy: 0, rotation: 0, color, life: 0 };
  }

  paint(object) {
    object.element.style.setProperty("--rsf-x", `${object.x}px`);
    object.element.style.setProperty("--rsf-y", `${object.y}px`);
    object.element.style.setProperty("--rsf-r", `${object.rotation}deg`);
    object.element.style.setProperty("--rsf-color", object.color);
  }

  aim(x, y) {
    this.player.rotation = (Math.atan2(y - this.player.y, x - this.player.x) * 180 / Math.PI + 450) % 360;
  }

  pointerDown(event) {
    if (this.pointerId !== null) return;
    this.pointerId = event.pointerId;
    this.root.setPointerCapture?.(event.pointerId);
    this.aim(event.clientX, event.clientY);
    this.shoot();
    this.timer = window.setInterval(() => this.shoot(), this.options.fireIntervalMs);
  }

  pointerUp(event) {
    if (event.pointerId === this.pointerId) this.release();
  }

  release() {
    this.pointerId = null;
    clearInterval(this.timer);
  }

  shoot() {
    const angle = (this.player.rotation - 90) * Math.PI / 180;
    this.player.vx -= Math.cos(angle) * this.options.recoilForce;
    this.player.vy -= Math.sin(angle) * this.options.recoilForce;
    const projectile = this.makeObject(
      "rsf-projectile", this.player.x, this.player.y,
      this.options.colorForHue(this.hue),
    );
    projectile.rotation = this.player.rotation;
    projectile.vx = Math.cos(angle) * this.options.projectileSpeed;
    projectile.vy = Math.sin(angle) * this.options.projectileSpeed;
    this.projectiles.push(projectile);
  }

  burst(source, edge) {
    const [min, max] = this.options.particleRange;
    const count = min + Math.floor(Math.random() * Math.max(1, max - min));
    for (let index = 0; index < count; index += 1) {
      const particle = this.makeObject("rsf-particle", source.x, source.y, source.color);
      const angle = Math.random() * Math.PI * 2;
      const [low, high] = this.options.particleSpeed;
      const speed = low + Math.random() * (high - low);
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.life = 10 + Math.floor(Math.random() * 40);
      particle.element.style.setProperty("--rsf-scale", String(.5 + Math.random() * 4));
      this.particles.push(particle);
    }
    this.options.onBoundaryHit({ edge, color: source.color, x: source.x, y: source.y });
  }

  updatePlayer() {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    this.player.vx *= this.options.damping;
    this.player.vy *= this.options.damping;
    this.player.x = Math.max(0, Math.min(width, this.player.x + this.player.vx));
    this.player.y = Math.max(0, Math.min(height, this.player.y + this.player.vy));
    this.paint(this.player);
  }

  updateProjectiles() {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const item = this.projectiles[index];
      item.x += item.vx;
      item.y += item.vy;
      this.paint(item);
      const edge = item.y <= 0 ? "top" : item.x >= width ? "right"
        : item.y >= height ? "bottom" : item.x <= 0 ? "left" : "";
      if (!edge) continue;
      this.burst(item, edge);
      item.element.remove();
      this.projectiles.splice(index, 1);
    }
  }

  updateParticles() {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const item = this.particles[index];
      item.x += item.vx;
      item.y += item.vy;
      item.vx *= this.options.damping;
      item.vy *= this.options.damping;
      item.life -= 1;
      this.paint(item);
      if (item.life >= 0) continue;
      item.element.classList.replace("rsf-particle", "rsf-residue");
      this.residue.push(item);
      this.particles.splice(index, 1);
    }
    while (this.residue.length > this.options.residueLimit) this.residue.shift().element.remove();
  }

  tick = () => {
    if (!this.running) return;
    if (!document.hidden) {
      this.hue = (this.hue + 1) % 360;
      this.updatePlayer();
      this.updateProjectiles();
      this.updateParticles();
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.root.addEventListener("pointermove", this.onMove);
    this.root.addEventListener("pointerdown", this.onDown);
    this.root.addEventListener("pointerup", this.onUp);
    this.root.addEventListener("pointercancel", this.onUp);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.frame = requestAnimationFrame(this.tick);
  }

  reset() {
    this.release();
    [...this.projectiles, ...this.particles, ...this.residue].forEach((item) => item.element.remove());
    this.projectiles = [];
    this.particles = [];
    this.residue = [];
    this.player.x = this.root.clientWidth / 2;
    this.player.y = this.root.clientHeight / 2;
    this.player.vx = 0;
    this.player.vy = 0;
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.release();
    this.root.removeEventListener("pointermove", this.onMove);
    this.root.removeEventListener("pointerdown", this.onDown);
    this.root.removeEventListener("pointerup", this.onUp);
    this.root.removeEventListener("pointercancel", this.onUp);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.reset();
    this.player.element.remove();
  }
}
