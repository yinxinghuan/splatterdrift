/**
 * Visual mechanism adapted from “CSS Splatters” by David Aerne (meodai), MIT.
 * Full source and permission notice: public/THIRD_PARTY_NOTICES.txt.
 */
import "./style.css";
import "./vendor/recoil-splatter-field.css";
import "./aigram-bridge.js";
import { SplatterdriftEngine, FIELD_H, FIELD_W } from "./engine.js";
import { CanvasRenderer } from "./renderer.js";
import { SplatterdriftLeaderboard } from "./leaderboard.js";
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
        <button class="sd-champion" type="button" hidden></button>
        <div class="sd-stats" aria-live="polite">
          <span><b data-stat="time">45</b><small>${t("time")}</small></span>
          <span><b data-stat="lives">3</b><small>${t("integrity")}</small></span>
          <span><b data-stat="targets">6</b><small>${t("targets")}</small></span>
          <span><b data-stat="score">0</b><small>${t("score")}</small></span>
        </div>
      </header>
      <section class="sd-field" tabindex="0" aria-label="${t("hint")}">
        <div class="sd-grid" aria-hidden="true"></div>
        <canvas class="sd-canvas" aria-hidden="true"></canvas>
        <div class="sd-combo" aria-live="polite"></div>
        <div class="sd-core" aria-live="polite">
          <span>${t("core")} <b data-core-level>×1</b></span>
          <i></i><i></i><i></i><i></i>
        </div>
        <div class="sd-wave" aria-live="polite"></div>
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
          <p class="sd-result__summary">
            <span>${t("best")} <b data-result="best">0</b></span>
            <span>${t("sectors")} <b data-result="waves">0</b></span>
          </p>
          <div class="sd-result__actions">
            <button class="sd-replay" type="button">
              <svg viewBox="0 0 36 20" aria-hidden="true">
                <g class="sd-replay__recoil">
                  <path d="M2 10h5M4 6.5h2M4 13.5h2"/>
                  <circle cx="13" cy="10" r="4.5"/>
                  <path d="M17.5 10h4"/>
                </g>
                <g class="sd-replay__shot">
                  <path d="M22 10h5"/>
                  <circle cx="31.5" cy="10" r="1.5"/>
                </g>
              </svg>
              <span>${t("replay")}</span>
            </button>
            <button class="sd-result-rank" type="button">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 18h16M6 15V9m6 6V5m6 10v-3"/>
                <circle cx="6" cy="7" r="1"/><circle cx="12" cy="3" r="1"/><circle cx="18" cy="10" r="1"/>
              </svg>
              <span>${t("viewLeaderboard")}</span>
            </button>
          </div>
        </section>
      </section>
      <section class="sd-unsupported" hidden>${t("unsupported")}</section>
      <section class="sd-leaderboard" role="dialog" aria-modal="true" aria-labelledby="sd-leaderboard-title" hidden>
        <div class="sd-leaderboard__panel">
          <header>
            <small>${t("leaderboardSub")}</small>
            <h2 id="sd-leaderboard-title">${t("leaderboardTitle")}</h2>
          </header>
          <div class="sd-leaderboard__list"></div>
          <button class="sd-leaderboard__close" type="button">${t("close")}</button>
        </div>
      </section>
    </main>`;

  if (!window.PointerEvent) {
    app.querySelector(".sd-unsupported").hidden = false;
    return;
  }

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    || matchMedia("(max-width: 340px)").matches;
  const field = app.querySelector(".sd-field");
  const canvas = app.querySelector(".sd-canvas");
  const hint = app.querySelector(".sd-hint");
  const combo = app.querySelector(".sd-combo");
  const core = app.querySelector(".sd-core");
  const coreLevel = app.querySelector("[data-core-level]");
  const waveLabel = app.querySelector(".sd-wave");
  const result = app.querySelector(".sd-result");
  const replay = app.querySelector(".sd-replay");
  const engine = new SplatterdriftEngine(90317, { bloomLimit: reduced ? 8 : 12 });
  const renderer = new CanvasRenderer(canvas, engine, { reduced });
  const leaderboard = new SplatterdriftLeaderboard({
    champion: app.querySelector(".sd-champion"),
    modal: app.querySelector(".sd-leaderboard"),
    list: app.querySelector(".sd-leaderboard__list"),
    close: app.querySelector(".sd-leaderboard__close"),
    resultButton: app.querySelector(".sd-result-rank"),
  });
  const touch = { session: null };
  let previous = performance.now();
  let hudAt = 0;
  let frame = 0;
  let waveLabelTimer = 0;

  const stat = (name) => app.querySelector(`[data-stat="${name}"]`);
  const resultValue = (name) => app.querySelector(`[data-result="${name}"]`);

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
    leaderboard.beginRun();
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
      leaderboard.beginRun();
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
      leaderboard.beginRun();
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
    leaderboard.resetRun();
    result.hidden = true;
    core.hidden = false;
    waveLabel.classList.remove("is-visible");
    hint.classList.remove("is-gone");
    combo.textContent = "";
    updateHud();
  });

  function updateHud() {
    stat("time").textContent = String(Math.ceil(engine.timeLeft));
    stat("lives").textContent = String(engine.lives);
    stat("targets").textContent = String(engine.asteroids.length);
    stat("score").textContent = String(engine.score);
    coreLevel.textContent = `×${engine.coreLevel}`;
    [...core.querySelectorAll("i")].forEach((segment, index) => {
      segment.classList.toggle("is-active", index < engine.coreLevel);
    });
    app.querySelector(".sd-shell").classList.toggle("is-danger", engine.lives === 1);
    if (engine.combo > 1 && engine.phase === "playing" && !engine.betweenWaves) {
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
    resultValue("waves").textContent = String(engine.metrics.wavesCleared);
    resultValue("best").textContent = String(best);
    core.hidden = true;
    waveLabel.classList.remove("is-visible");
    result.hidden = false;
    leaderboard.submit(engine.score);
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
      if (event.type === "core") {
        splatterAudio.core(event.level);
        core.classList.remove("is-rise");
        void core.offsetWidth;
        core.classList.add("is-rise");
      }
      if (event.type === "wave-clear") {
        splatterAudio.wave();
        waveLabel.textContent = `${t("sector")} ${String(event.nextWave).padStart(2, "0")}`;
        waveLabel.classList.add("is-visible");
        window.clearTimeout(waveLabelTimer);
        waveLabelTimer = window.setTimeout(() => waveLabel.classList.remove("is-visible"), 620);
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
  }, { once: true });
  window.__SPLATTERDRIFT__ = { baseline: false, engine, renderer, leaderboard, field };
}
