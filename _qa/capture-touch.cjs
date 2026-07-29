const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const root = "/Users/yin/code/games/splatterdrift";
const url = "http://127.0.0.1:5174/";

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
  await page.waitForTimeout(35);
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
    engine.finish("time");
  });
  await page.waitForTimeout(100);
  const resultBox = await page.locator(".sd-result").boundingBox();
  const replayBox = await page.locator(".sd-replay").boundingBox();
  assert.ok(resultBox);
  assert.ok(replayBox && replayBox.width >= 44 && replayBox.height >= 44);
  await page.screenshot({
    path: path.join(root, `_qa/ui/${pass}-platform-layout-result-${width}x${height}.png`),
    fullPage: true,
  });

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

  assert.deepEqual(errors, []);
  await context.close();
  return { width, height, beforeArm, playState, beforeBrake, afterBrake, stress, metrics };
}

;(async () => {
  const pass = process.argv[2] || "first";
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [
      await runViewport(browser, 390, 844, pass),
      await runViewport(browser, 320, 568, pass),
    ];
    const baselineContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
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

    const externalContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const externalPage = await externalContext.newPage();
    await externalPage.goto(url, { waitUntil: "networkidle" });
    assert.ok(await externalPage.locator("#alteru-guest-banner").count());
    const externalField = await externalPage.locator(".sd-field").boundingBox();
    await externalPage.screenshot({
      path: path.join(root, `_qa/ui/${pass}-external-guest-idle-390x844.png`),
      fullPage: true,
    });
    assert.ok(externalField && externalField.y + externalField.height > 0 && externalField.y < 844);
    await externalContext.close();
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})();
