const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const root = "/Users/yin/code/games/splatterdrift";
const url = process.env.SD_QA_URL || "http://127.0.0.1:5174/";

async function dispatchTouch(client, type, x, y) {
  await client.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: type === "touchEnd" ? [] : [{
      x,
      y,
      radiusX: 9,
      radiusY: 9,
      force: 0.64,
      id: 1,
    }],
  });
}

async function runViewport(browser, width, height, pass) {
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  await context.route("https://images.aiwaves.tech/alteru/guest-shell.js", (route) => route.fulfill({
    contentType: "application/javascript",
    body: "/* QA platform bridge: guest shell is absent inside AlterU. */",
  }));
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "#alteru-guest-banner{display:none!important}" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(50);

  const field = page.locator(".sd-field");
  const box = await field.boundingBox();
  assert.ok(box, "playfield must be visible");
  const metrics = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: innerWidth,
    field: document.querySelector(".sd-field").getBoundingClientRect().toJSON(),
    button: document.querySelector(".sd-replay").getBoundingClientRect().toJSON(),
  }));
  assert.ok(metrics.bodyWidth <= metrics.viewportWidth);
  assert.ok(metrics.field.top >= 0 && metrics.field.bottom <= height);
  assert.equal(await page.locator(".sd-champion").isHidden(), true);

  await page.screenshot({
    path: path.join(root, `_qa/ui/${pass}-platform-layout-idle-${width}x${height}.png`),
    fullPage: true,
  });

  await page.evaluate(() => {
    const engine = window.__SPLATTERDRIFT__.engine;
    engine.asteroids = [{
      id: 8100,
      x: 268,
      y: 260,
      vx: 0,
      vy: 0,
      radius: 24,
      tier: 2,
      rotation: 0,
      spin: 0,
      shape: 1,
    }, {
      id: 8101,
      x: 70,
      y: 100,
      vx: 0,
      vy: 0,
      radius: 24,
      tier: 2,
      rotation: 0,
      spin: 0,
      shape: 2,
    }];
  });

  const client = await context.newCDPSession(page);
  const start = { x: box.x + box.width * 0.78, y: box.y + box.height * 0.50 };
  await dispatchTouch(client, "touchStart", start.x, start.y);
  await page.waitForTimeout(25);
  const beforeArm = await page.evaluate(() => {
    const engine = window.__SPLATTERDRIFT__.engine;
    return { shots: engine.metrics.shots, held: engine.held, aimMode: engine.aimMode };
  });
  assert.deepEqual(beforeArm, { shots: 0, held: false, aimMode: "direction" });
  await page.waitForTimeout(105);
  if (width === 390) {
    await page.screenshot({
      path: path.join(root, `_qa/ui/${pass}-platform-layout-motion-a-${width}x${height}.png`),
      fullPage: true,
    });
  }
  await page.waitForTimeout(85);
  if (width === 390) {
    await page.screenshot({
      path: path.join(root, `_qa/ui/${pass}-platform-layout-motion-b-${width}x${height}.png`),
      fullPage: true,
    });
  }
  await page.waitForTimeout(90);
  await dispatchTouch(client, "touchEnd", start.x, start.y);
  await page.waitForTimeout(130);
  const playState = await page.evaluate(() => {
    const engine = window.__SPLATTERDRIFT__.engine;
    const renderer = window.__SPLATTERDRIFT__.renderer;
    return {
      shots: engine.metrics.shots,
      hits: engine.metrics.hits,
      blooms: engine.blooms.length,
      held: engine.held,
      particleCount: renderer.particleCount,
      trailSamples: renderer.trail.length,
      scrollY,
    };
  });
  assert.ok(playState.shots >= 1);
  assert.ok(playState.hits >= 1);
  assert.ok(playState.blooms >= 1);
  assert.equal(playState.held, false);
  assert.equal(playState.scrollY, 0);
  assert.ok(playState.particleCount > 0);
  assert.ok(playState.particleCount <= (width <= 320 ? 220 : 420));
  assert.ok(playState.trailSamples >= 2);
  await page.screenshot({
    path: path.join(root, `_qa/ui/${pass}-platform-layout-hit-${width}x${height}.png`),
    fullPage: true,
  });

  const beforeBrake = await page.evaluate(() => {
    const engine = window.__SPLATTERDRIFT__.engine;
    const bloom = engine.blooms[0];
    engine.ship.x = bloom.x - 28;
    engine.ship.y = bloom.y;
    engine.ship.vx = 120;
    engine.ship.vy = 0;
    return { vx: engine.ship.vx, brakeEvents: engine.metrics.brakeEvents };
  });
  await page.waitForTimeout(110);
  const afterBrake = await page.evaluate(() => {
    const engine = window.__SPLATTERDRIFT__.engine;
    return {
      vx: engine.ship.vx,
      brakeEvents: engine.metrics.brakeEvents,
      blooms: engine.blooms.length,
      scrollY,
    };
  });
  assert.ok(Math.abs(afterBrake.vx) < Math.abs(beforeBrake.vx) * 0.5);
  assert.equal(afterBrake.brakeEvents, beforeBrake.brakeEvents + 1);
  assert.equal(afterBrake.blooms, 0);
  assert.equal(afterBrake.scrollY, 0);
  await page.screenshot({
    path: path.join(root, `_qa/ui/${pass}-platform-layout-brake-${width}x${height}.png`),
    fullPage: true,
  });

  await page.evaluate(() => {
    const engine = window.__SPLATTERDRIFT__.engine;
    engine.combo = 4;
    engine.lastHitAt = engine.elapsed;
    engine.shotsSinceHit = 0;
    engine.invulnerable = 1;
    engine.ship.x = 180;
    engine.ship.y = 260;
    engine.ship.vx = 0;
    engine.ship.vy = 0;
    engine.fire();
  });
  await page.waitForTimeout(110);
  const coreGrowth = await page.evaluate(() => {
    const engine = window.__SPLATTERDRIFT__.engine;
    return {
      core: engine.coreLevel,
      bullets: engine.bullets.length,
      recoil: Math.hypot(engine.ship.vx, engine.ship.vy),
      label: document.querySelector("[data-core-level]").textContent,
    };
  });
  assert.equal(coreGrowth.core, 4);
  assert.ok(coreGrowth.bullets >= 2);
  assert.equal(coreGrowth.label, "×4");
  if (width === 390) {
    await page.screenshot({
      path: path.join(root, `_qa/ui/${pass}-platform-layout-core-x4-${width}x${height}.png`),
      fullPage: true,
    });
  }

  await page.evaluate(() => {
    const engine = window.__SPLATTERDRIFT__.engine;
    engine.held = false;
    engine.bullets = [];
    engine.blooms = [];
    engine.asteroids = [];
  });
  await page.waitForTimeout(80);
  const waveClear = await page.evaluate(() => {
    const engine = window.__SPLATTERDRIFT__.engine;
    return {
      wave: engine.wave,
      wavesCleared: engine.metrics.wavesCleared,
      delay: engine.waveDelay,
      labelVisible: document.querySelector(".sd-wave").classList.contains("is-visible"),
    };
  });
  assert.equal(waveClear.wave, 2);
  assert.equal(waveClear.wavesCleared, 1);
  assert.ok(waveClear.delay > 0);
  assert.equal(waveClear.labelVisible, true);
  if (width === 390) {
    await page.screenshot({
      path: path.join(root, `_qa/ui/${pass}-platform-layout-wave-clear-${width}x${height}.png`),
      fullPage: true,
    });
  }
  await page.waitForTimeout(650);
  const waveStart = await page.evaluate(() => {
    const engine = window.__SPLATTERDRIFT__.engine;
    return { wave: engine.wave, targets: engine.asteroids.length, betweenWaves: engine.betweenWaves };
  });
  assert.deepEqual(waveStart, { wave: 2, targets: 5, betweenWaves: false });

  await page.evaluate(() => {
    const engine = window.__SPLATTERDRIFT__.engine;
    engine.finish("time");
  });
  await page.waitForTimeout(100);
  const resultBox = await page.locator(".sd-result").boundingBox();
  const replayBox = await page.locator(".sd-replay").boundingBox();
  const rankBox = await page.locator(".sd-result-rank").boundingBox();
  assert.ok(resultBox);
  assert.ok(replayBox && replayBox.width >= 44 && replayBox.height >= 44);
  assert.ok(rankBox && rankBox.width >= 44 && rankBox.height >= 44);
  await page.screenshot({
    path: path.join(root, `_qa/ui/${pass}-platform-layout-result-${width}x${height}.png`),
    fullPage: true,
  });

  await page.locator(".sd-result-rank").click();
  assert.equal(await page.locator(".sd-leaderboard").isVisible(), true);
  assert.equal(await page.locator(".sd-leaderboard__download a").getAttribute("href"), "https://alteru.app");
  if (width === 390) {
    await page.screenshot({
      path: path.join(root, `_qa/ui/${pass}-platform-layout-leaderboard-download-${width}x${height}.png`),
      fullPage: true,
    });
  }
  await page.locator(".sd-leaderboard__close").click();

  const stress = await page.evaluate(async ({ compact }) => {
    const renderer = window.__SPLATTERDRIFT__.renderer;
    renderer.process(Array.from({ length: compact ? 8 : 14 }, (_, index) => ({
      type: "hit",
      x: 80 + (index % 5) * 50,
      y: 120 + (index % 7) * 42,
      nx: index % 2 ? 0.8 : -0.8,
      ny: index % 3 ? 0.45 : -0.45,
      tier: index % 2 ? 1 : 2,
    })));
    const peakParticleCount = renderer.particleCount;
    const deltas = [];
    await new Promise((resolve) => {
      let previous = performance.now();
      const sample = (now) => {
        deltas.push(now - previous);
        previous = now;
        if (deltas.length >= 90) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const sorted = deltas.slice(5).sort((a, b) => a - b);
    return {
      peakParticleCount,
      particleCount: renderer.particleCount,
      medianMs: sorted[Math.floor(sorted.length * 0.5)],
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
    };
  }, { compact: width <= 320 });
  assert.ok(stress.peakParticleCount <= (width <= 320 ? 220 : 420));
  assert.ok(stress.p95Ms < 28, `p95 frame interval ${stress.p95Ms}ms is too high`);

  await page.locator(".sd-replay").click();
  const replayState = await page.evaluate(() => ({
    phase: window.__SPLATTERDRIFT__.engine.phase,
    resultHidden: document.querySelector(".sd-result").hidden,
  }));
  assert.deepEqual(replayState, { phase: "ready", resultHidden: true });

  assert.deepEqual(errors, []);
  await context.close();
  return {
    width,
    height,
    beforeArm,
    playState,
    beforeBrake,
    afterBrake,
    coreGrowth,
    waveClear,
    waveStart,
    stress,
    replayState,
    metrics,
  };
}

async function runLeaderboardViewport(browser, width, height, pass) {
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });
  await context.route("https://images.aiwaves.tech/alteru/guest-shell.js", (route) => route.fulfill({
    contentType: "application/javascript",
    body: "/* QA platform bridge: guest shell is absent inside AlterU. */",
  }));
  await context.addInitScript(() => {
    window.__qaApiCalls = [];
    window.__qaSelfScore = 200;
    const decode = (value) => decodeURIComponent(escape(atob(value)));
    const encode = (value) => btoa(unescape(encodeURIComponent(value)));
    const avatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%2378d7e5'/%3E%3Ccircle cx='20' cy='15' r='7' fill='%2311161a'/%3E%3Cpath d='M7 38c2-10 8-14 13-14s11 4 13 14' fill='%2311161a'/%3E%3C/svg%3E";
    window.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      if (event.data.startsWith("AW.PROFILE.OPEN-")) {
        window.__qaApiCalls.push({ aw: event.data });
        return;
      }
      if (!event.data.startsWith("callAPI-")) return;
      const request = JSON.parse(decode(event.data.slice("callAPI-".length)));
      window.__qaApiCalls.push(request);
      if (request.url.includes("/rank/score/save")) {
        window.__qaSelfScore = Number(request.data?.score) || 0;
      }
      const updated = window.__qaSelfScore > 900;
      const rows = updated
        ? [
          { user_id: "100", user_name: "Pilot One", head_url: "", score: String(window.__qaSelfScore), rank: 1 },
          { user_id: "900", user_name: "Nova Vector With A Long Name", head_url: avatar, score: "900", rank: 2 },
          { user_id: "600", user_name: "Kite", head_url: "", score: "600", rank: 3 },
        ]
        : [
          { user_id: "900", user_name: "Nova Vector With A Long Name", head_url: avatar, score: "900", rank: 1 },
          { user_id: "600", user_name: "Kite", head_url: "", score: "600", rank: 2 },
          { user_id: "100", user_name: "Pilot One", head_url: "", score: "200", rank: 3 },
        ];
      const data = request.url.includes("/rank/score/list/")
        ? { retcode: 0, data: rows }
        : { retcode: 0, data: true };
      const response = {
        request_id: request.request_id,
        success: true,
        data,
      };
      window.postMessage(`callAPIResult-${encode(JSON.stringify(response))}`, location.origin);
    });
  });

  const page = await context.newPage();
  const platformOrigin = new URL(url).origin;
  const platformUrl = `${url}?api_origin=${encodeURIComponent(platformOrigin)}&telegram_id=100`;
  await page.goto(platformUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector(".sd-champion__name")?.textContent.includes("Nova"));
  assert.equal(await page.locator(".sd-champion").isVisible(), true);
  assert.equal(await page.locator(".sd-champion__avatar img").count(), 1);
  await page.locator(".sd-champion").click();
  await page.waitForFunction(() => document.querySelectorAll(".sd-leaderboard__row").length === 3);
  assert.equal(await page.locator(".sd-leaderboard__row").count(), 3);
  assert.equal(await page.locator(".sd-leaderboard__row.is-self").count(), 1);
  assert.equal(await page.locator("button.sd-leaderboard__row").count(), 2);
  const panelBox = await page.locator(".sd-leaderboard__panel").boundingBox();
  assert.ok(panelBox && panelBox.y >= 0 && panelBox.y + panelBox.height <= height);
  await page.screenshot({
    path: path.join(root, `_qa/ui/${pass}-platform-layout-leaderboard-${width}x${height}.png`),
    fullPage: true,
  });

  await page.locator("button.sd-leaderboard__row").first().click();
  await page.waitForFunction(() => window.__qaApiCalls.some((call) => call.aw?.startsWith("AW.PROFILE.OPEN-")));
  await page.locator(".sd-leaderboard__close").click();

  await page.evaluate(() => {
    const game = window.__SPLATTERDRIFT__;
    game.leaderboard.beginRun();
    game.engine.score = 1000;
    game.engine.finish("time");
  });
  await page.waitForFunction(() => window.__qaApiCalls.some((call) => (
    call.url === "/note/aigram/ai/game/record/play"
    && call.data?.event === "score_beat"
  )));
  const apiEvidence = await page.evaluate(() => {
    const calls = window.__qaApiCalls;
    const save = calls.find((call) => call.url?.includes("/rank/score/save"));
    const notify = calls.find((call) => (
      call.url === "/note/aigram/ai/game/record/play"
      && call.data?.event === "score_beat"
    ));
    return {
      saveScore: save?.data?.score,
      notifyTarget: notify?.data?.config_json?.actions?.[0]?.target_user_id,
      notifyActions: notify?.data?.config_json?.actions?.length,
      profileOpen: calls.some((call) => call.aw?.startsWith("AW.PROFILE.OPEN-")),
    };
  });
  assert.deepEqual(apiEvidence, {
    saveScore: 1000,
    notifyTarget: "900",
    notifyActions: 1,
    profileOpen: true,
  });
  await page.screenshot({
    path: path.join(root, `_qa/ui/${pass}-platform-layout-ranked-result-${width}x${height}.png`),
    fullPage: true,
  });
  await context.close();
  return { width, height, apiEvidence };
}

;(async () => {
  const pass = process.argv[2] || "first";
  const mode = process.argv[3] || "all";
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    if (mode === "all" || mode === "game" || mode === "game390") {
      results.push(await runViewport(browser, 390, 844, pass));
    }
    if (mode === "all" || mode === "game" || mode === "game320") {
      results.push(await runViewport(browser, 320, 568, pass));
    }
    const leaderboardResults = [];
    if (mode === "all" || mode === "leaderboard" || mode === "lb390") {
      leaderboardResults.push(await runLeaderboardViewport(browser, 390, 844, pass));
    }
    if (mode === "all" || mode === "leaderboard" || mode === "lb320") {
      leaderboardResults.push(await runLeaderboardViewport(browser, 320, 568, pass));
    }
    if (mode !== "all" && mode !== "aux") {
      console.log(JSON.stringify({ results, leaderboardResults }, null, 2));
      return;
    }
    const baselineContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    await baselineContext.route("https://images.aiwaves.tech/alteru/guest-shell.js", (route) => route.fulfill({
      contentType: "application/javascript",
      body: "/* QA platform bridge: guest shell is absent inside AlterU. */",
    }));
    const baselinePage = await baselineContext.newPage();
    await baselinePage.goto(`${url}?baseline=1`, { waitUntil: "networkidle" });
    assert.ok(await baselinePage.locator(".rsf-player").count());
    const baselineClient = await baselineContext.newCDPSession(baselinePage);
    await dispatchTouch(baselineClient, "touchStart", 330, 422);
    await baselinePage.waitForTimeout(320);
    await dispatchTouch(baselineClient, "touchEnd", 330, 422);
    assert.ok(
      await baselinePage.locator(".rsf-residue, .rsf-particle, .rsf-projectile").count(),
      "baseline touch must produce projectile, particle, or residue nodes",
    );
    await baselinePage.screenshot({
      path: path.join(root, `_qa/ui/${pass}-baseline-390x844.png`),
      fullPage: true,
    });
    await baselineContext.close();

    const zhContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    await zhContext.route("https://images.aiwaves.tech/alteru/guest-shell.js", (route) => route.fulfill({
      contentType: "application/javascript",
      body: "/* QA platform bridge: guest shell is absent inside AlterU. */",
    }));
    const zhPage = await zhContext.newPage();
    await zhPage.goto(url, { waitUntil: "networkidle" });
    await zhPage.evaluate(() => localStorage.setItem("game_locale", "zh"));
    await zhPage.reload({ waitUntil: "networkidle" });
    await zhPage.addStyleTag({ content: "#alteru-guest-banner{display:none!important}" });
    await zhPage.evaluate(() => {
      document.querySelector(".sd-hint").classList.add("is-gone");
      window.__SPLATTERDRIFT__.engine.finish("time");
    });
    await zhPage.waitForTimeout(80);
    const zhReplay = await zhPage.locator(".sd-replay").boundingBox();
    assert.ok(zhReplay && zhReplay.width >= 44 && zhReplay.height >= 44);
    assert.equal(await zhPage.locator(".sd-replay span").textContent(), "再次入轨");
    await zhPage.screenshot({
      path: path.join(root, `_qa/ui/${pass}-platform-layout-result-zh-390x844.png`),
      fullPage: true,
    });
    await zhContext.close();

    const externalContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const externalPage = await externalContext.newPage();
    await externalPage.goto(url, { waitUntil: "domcontentloaded" });
    await externalPage.locator("#alteru-guest-banner").waitFor({ state: "attached", timeout: 12000 });
    assert.ok(await externalPage.locator("#alteru-guest-banner").count());
    assert.equal(await externalPage.locator(".sd-champion").isHidden(), true);
    const externalField = await externalPage.locator(".sd-field").boundingBox();
    await externalPage.screenshot({
      path: path.join(root, `_qa/ui/${pass}-external-guest-idle-390x844.png`),
      fullPage: true,
    });
    assert.ok(externalField && externalField.y + externalField.height > 0 && externalField.y < 844);
    await externalContext.close();
    console.log(JSON.stringify({ results, leaderboardResults }, null, 2));
  } finally {
    await browser.close();
  }
})();
