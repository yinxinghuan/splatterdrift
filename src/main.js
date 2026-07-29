/**
 * Visual mechanism adapted from “CSS Splatters” by David Aerne (meodai), MIT.
 * Full source and permission notice: public/THIRD_PARTY_NOTICES.txt.
 */
import "./style.css";
import "./vendor/recoil-splatter-field.css";
import { SplatterdriftEngine, FIELD_H, FIELD_W } from "./engine.js";
import { DomRenderer } from "./renderer.js";
import { RecoilSplatterField } from "./vendor/recoil-splatter-field.js";
import { splatterAudio } from "./audio.js";
import { t } from "./i18n.js";

const params = new URLSearchParams(location.search);
const baseline = params.get("baseline") === "1";
const app = document.querySelector("#app");

if (baseline) {
  document.documentElement.classList.add("sd-is-baseline");
  app.innerHTML = '<main class="sd-baseline" aria-label="Recoil splatter baseline"></main>';
  const root = app.querySelector(".sd-baseline");
  const field = new RecoilSplatterField(root, {
    fireIntervalMs: 54,
    projectileSpeed: 25,
    recoilForce: 1.55,
    particleRange: [10, 30],
    residueLimit: matchMedia("(max-width: 340px)").matches ? 120 : 280,
    colorForHue: (hue) => `oklch(82% 0.19 ${hue})`,
  });
  field.start();
  window.__SPLATTERDRIFT__ = { baseline: true, field };
} else {
  startProduct();
}

function startProduct() {
  app.innerHTML = `
    <main class="sd-shell">
      <header class="sd-header">
        <div class="sd-lockup"><small>${t("eyebrow")}</small><h1>${t("title")}</h1></div>
        <div class="sd-stats" aria-live="polite">
          <span><b data-stat="time">45</b><small>${t("time")}</small></span>
          <span><b data-stat="lives">3</b><small>${t("integrity")}</small></span>
          <span><b data-stat="targets">6</b><small>${t("targets")}</small></span>
          <span><b data-stat="score">0</b><small>${t("score")}</small></span>
        </div>
      </header>
      <section class="sd-field" tabindex="0" aria-label="${t("hint")}">
        <div class="sd-grid" aria-hidden="true"></div>
        <div class="sd-world" aria-hidden="true"></div>
        <div class="sd-combo" aria-live="polite"></div>
        <div class="sd-hint">
          <strong>${t("hint")}</strong>
          <span>${t("hintBrake")}</span>
        </div>
        <section class="sd-result" aria-live="assertive" hidden>
          <small data-result="kind"></small>
          <strong data-result="score">0</strong>
          <div class="sd-result__metrics">
            <span><b data-result="cleared">0</b><small>${t("cleared")}</small></span>
            <span><b data-result="accuracy">0%</b><small>${t("accuracy")}</small></span>
            <span><b data-result="combo">×1</b><small>${t("maxCombo")}</small></span>
            <span><b data-result="brakes">0</b><small>${t("brakes")}</small></span>
          </div>
          <p><span>${t("best")}</span> <b data-result="best">0</b></p>
          <button class="sd-replay" type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 8.5V4m0 0H9M4.5 4l3.1 3.1A7.2 7.2 0 1 1 5 13"/></svg>
            ${t("replay")}
          </button>
        </section>
      </section>
      <section class="sd-unsupported" hidden>${t("unsupported")}</section>
    </main>`;

  if (!window.PointerEvent) {
    app.querySelector(".sd-unsupported").hidden = false;
    return;
  }

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    || matchMedia("(max-width: 340px)").matches;
  const field = app.querySelector(".sd-field");
  const world = app.querySelector(".sd-world");
  const hint = app.querySelector(".sd-hint");
  const combo = app.querySelector(".sd-combo");
  const result = app.querySelector(".sd-result");
  const replay = app.querySelector(".sd-replay");
  const engine = new SplatterdriftEngine(90317, { bloomLimit: reduced ? 8 : 12 });
  const renderer = new DomRenderer(world, engine, { reduced });
  const touch = { session: null };
  let previous = performance.now();
  let hudAt = 0;
  let frame = 0;

  const stat = (name) => app.querySelector(`[data-stat="${name}"]`);
  const resultValue = (name) => app.querySelector(`[data-result="${name}"]`);

  function syncFieldScale() {
    field.style.setProperty("--field-scale", String(field.clientWidth / FIELD_W));
  }
  syncFieldScale();
  const resizeObserver = new ResizeObserver(syncFieldScale);
  resizeObserver.observe(field);

  function pointFromEvent(event) {
    const rect = field.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * FIELD_W,
      y: ((event.clientY - rect.top) / rect.height) * FIELD_H,
    };
  }

  function setTouchAim(x, y) {
    const dx = x - engine.ship.x;
    const dy = y - engine.ship.y;
    if (Math.hypot(dx, dy) >= 12) engine.setAimDirection(dx, dy);
  }

  function beginTouchFire(session) {
    if (touch.session !== session || session.firing) return;
    setTouchAim(session.x, session.y);
    engine.pointerDownDirection(engine.aimDirectionX, engine.aimDirectionY);
    session.firing = true;
    if (session.timer !== null) {
      clearTimeout(session.timer);
      session.timer = null;
    }
  }

  function clearTouch(fireShortTap) {
    const session = touch.session;
    if (!session) return;
    if (session.timer !== null) clearTimeout(session.timer);
    if (fireShortTap && !session.firing) beginTouchFire(session);
    engine.pointerUp();
    touch.session = null;
  }

  field.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    event.preventDefault();
    if (event.pointerType !== "touch") field.focus({ preventScroll: true });
    splatterAudio.unlock();
    if (event.pointerType === "touch" && touch.session) return;
    field.setPointerCapture?.(event.pointerId);
    const point = pointFromEvent(event);
    hint.classList.add("is-gone");
    if (event.pointerType !== "touch") {
      engine.pointerDownPoint(point.x, point.y);
      return;
    }
    const session = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      x: point.x,
      y: point.y,
      firing: false,
      timer: null,
    };
    touch.session = session;
    setTouchAim(point.x, point.y);
    session.timer = window.setTimeout(() => beginTouchFire(session), 65);
  });

  field.addEventListener("pointermove", (event) => {
    const point = pointFromEvent(event);
    if (event.pointerType !== "touch") {
      engine.setAimPoint(point.x, point.y);
      return;
    }
    const session = touch.session;
    if (!session || session.pointerId !== event.pointerId) return;
    session.x = point.x;
    session.y = point.y;
    setTouchAim(point.x, point.y);
    if (Math.hypot(point.x - session.startX, point.y - session.startY) >= 10) {
      beginTouchFire(session);
    }
  });

  field.addEventListener("pointerup", (event) => {
    if (field.hasPointerCapture?.(event.pointerId)) field.releasePointerCapture(event.pointerId);
    if (event.pointerType === "touch") {
      if (touch.session?.pointerId === event.pointerId) clearTouch(true);
    } else {
      engine.pointerUp();
    }
  });

  field.addEventListener("pointercancel", (event) => {
    if (event.pointerType === "touch") {
      if (touch.session?.pointerId === event.pointerId) clearTouch(false);
    } else {
      engine.pointerUp();
    }
  });

  field.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") engine.rotateAim(-Math.PI / 24);
    if (event.key === "ArrowRight") engine.rotateAim(Math.PI / 24);
    if (event.key === "ArrowUp") engine.rotateAim(-Math.PI / 24);
    if (event.key === "ArrowDown") engine.rotateAim(Math.PI / 24);
    if (event.code === "Space" && !event.repeat) {
      event.preventDefault();
      splatterAudio.unlock();
      hint.classList.add("is-gone");
      engine.pointerDownDirection(engine.aimDirectionX, engine.aimDirectionY);
    }
  });

  field.addEventListener("keyup", (event) => {
    if (event.code === "Space") engine.pointerUp();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTouch(false);
      engine.pointerUp();
      previous = performance.now();
    }
  });

  replay.addEventListener("click", () => {
    clearTouch(false);
    engine.reset();
    renderer.reset();
    result.hidden = true;
    hint.classList.remove("is-gone");
    combo.textContent = "";
    updateHud();
  });

  function updateHud() {
    stat("time").textContent = String(Math.ceil(engine.timeLeft));
    stat("lives").textContent = String(engine.lives);
    stat("targets").textContent = String(engine.asteroids.length);
    stat("score").textContent = String(engine.score);
    app.querySelector(".sd-shell").classList.toggle("is-danger", engine.lives === 1);
    if (engine.combo > 1 && engine.phase === "playing") {
      combo.textContent = `×${engine.combo}`;
      const scale = field.clientWidth / FIELD_W;
      combo.style.setProperty("--combo-x", `${engine.ship.x * scale}px`);
      combo.style.setProperty("--combo-y", `${engine.ship.y * scale}px`);
      combo.classList.add("is-visible");
    } else {
      combo.classList.remove("is-visible");
    }
  }

  function showResult(phase) {
    const bestKey = "splatterdrift_best";
    const oldBest = Number.parseInt(localStorage.getItem(bestKey) || "0", 10);
    const best = Math.max(oldBest, engine.score);
    localStorage.setItem(bestKey, String(best));
    resultValue("kind").textContent = phase === "won" ? t("won")
      : phase === "failed" ? t("failed") : t("timeEnd");
    resultValue("score").textContent = String(engine.score);
    resultValue("cleared").textContent = String(engine.metrics.destroyed);
    resultValue("accuracy").textContent = `${Math.round(engine.accuracy * 100)}%`;
    resultValue("combo").textContent = `×${engine.maxCombo}`;
    resultValue("brakes").textContent = String(engine.metrics.brakeEvents);
    resultValue("best").textContent = String(best);
    result.hidden = false;
  }

  function handleEvents(events) {
    renderer.process(events);
    for (const event of events) {
      if (event.type === "shot") splatterAudio.shot();
      if (event.type === "hit") {
        splatterAudio.hit(event.tier);
        if (navigator.vibrate) navigator.vibrate(event.tier === 2 ? 10 : 14);
      }
      if (event.type === "brake") {
        splatterAudio.brake();
        if (navigator.vibrate) navigator.vibrate(12);
      }
      if (event.type === "collision") splatterAudio.collision(event.lives <= 0);
      if (event.type === "finish") {
        splatterAudio.finish(event.phase);
        showResult(event.phase);
      }
    }
  }

  function loop(now) {
    const delta = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    if (!document.hidden) {
      engine.advance(delta);
      const events = engine.consumeEvents();
      handleEvents(events);
      renderer.sync(delta);
      if (now - hudAt > 80) {
        updateHud();
        hudAt = now;
      }
    }
    frame = requestAnimationFrame(loop);
  }

  updateHud();
  renderer.sync(0);
  frame = requestAnimationFrame(loop);
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
  }, { once: true });
  window.__SPLATTERDRIFT__ = { baseline: false, engine, renderer, field };
}
