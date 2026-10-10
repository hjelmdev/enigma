import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
/* global document, innerHeight, innerWidth */

// Optional external QA dependency: npm install --no-save playwright, or use
// the desktop app's bundled package via HORIZON_NODE_MODULES.
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.HORIZON_NODE_MODULES
    ? path.join(process.env.HORIZON_NODE_MODULES, 'playwright')
    : 'playwright',
);
const out = path.resolve('artifacts/hidden-horizon');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.HORIZON_BROWSER
    ? { executablePath: process.env.HORIZON_BROWSER }
    : {}),
});
const errors = [];
const base = process.env.HORIZON_URL || 'http://127.0.0.1:5173/';
const url = `${base}?experiment=hidden-horizon`;
const report = [];
try {
  for (const [name, width, height] of [
    ['desktop', 1440, 900],
    ['portrait', 390, 844],
    ['landscape', 844, 390],
    ['small-portrait', 320, 568],
    ['small-landscape', 667, 375],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: name !== 'desktop',
      ...(name === 'desktop' && process.env.HORIZON_VIDEO === '1'
        ? { recordVideo: { dir: out, size: { width: 960, height: 600 } } }
        : {}),
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url);
    await page
      .getByRole('button', { name: 'Mekanismen', exact: true })
      .waitFor();
    await page.waitForFunction(
      () => !document.querySelector('[data-action="mechanism"]').disabled,
    );
    await page.screenshot({ path: path.join(out, `${name}-room.png`) });
    const artLayers = await page.evaluate(async () => {
      const { generateArt } =
        await import('/src/experiments/hidden-horizon/art/generate.ts');
      return Object.fromEntries(
        Object.entries(generateArt()).map(([key, raster]) => [
          key,
          raster.canvas().toDataURL().split(',')[1],
        ]),
      );
    });
    if (name === 'desktop')
      for (const [key, base64] of Object.entries(artLayers))
        await writeFile(
          path.join(out, `art-${key}.png`),
          Buffer.from(base64, 'base64'),
        );
    assert(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight === innerHeight &&
          document.documentElement.scrollWidth === innerWidth,
      ),
      `${name}: document overflow`,
    );
    await page.getByRole('button', { name: 'Reliefen', exact: true }).click();
    await page.screenshot({ path: path.join(out, `${name}-relief.png`) });
    await page.getByRole('button', { name: 'Undersök mekanismen →' }).click();
    await page.getByRole('button', { name: 'Höj Vassen' }).click();
    await page.getByRole('button', { name: '← Tillbaka' }).click();
    await page.getByRole('button', { name: 'Mekanismen', exact: true }).click();
    assert.equal(await page.locator('output').first().textContent(), '1 steg');
    await page.reload();
    await page.waitForFunction(
      () => !document.querySelector('[data-action="mechanism"]').disabled,
    );
    await page.getByRole('button', { name: 'Mekanismen', exact: true }).click();
    assert.equal(
      await page.locator('output').first().textContent(),
      '1 steg',
      'IndexedDB partial progress survives reload',
    );
    await page.getByRole('button', { name: 'Pröva himlen' }).click();
    assert(await page.locator('.horizon-feedback').textContent());
    await page.getByRole('button', { name: 'Se reliefen' }).click();
    await page.getByRole('button', { name: 'Undersök mekanismen →' }).click();
    assert.equal(await page.locator('output').first().textContent(), '1 steg');
    await page.getByRole('button', { name: 'En ledtråd' }).click();
    await page.screenshot({ path: path.join(out, `${name}-puzzle.png`) });
    for (const button of await page.locator('.horizon-dialog button').all()) {
      if (!(await button.isVisible())) continue;
      const box = await button.boundingBox();
      assert(
        box &&
          box.y >= 0 &&
          box.y + box.height <= height &&
          box.x >= 0 &&
          box.x + box.width <= width,
        `${name}: clipped control`,
      );
      assert(box.height >= 44, `${name}: small touch target`);
    }
    const feedbackBox = await page.locator('.horizon-feedback').boundingBox();
    assert(
      feedbackBox && feedbackBox.y + feedbackBox.height <= height - 8,
      `${name}: clipped puzzle feedback`,
    );
    await page.getByRole('button', { name: 'Höj Vassen' }).click();
    for (let i = 0; i < 3; i++)
      await page.getByRole('button', { name: 'Höj Falken' }).click();
    for (let i = 0; i < 2; i++)
      await page.getByRole('button', { name: 'Sänk Båten' }).click();
    await page.getByRole('button', { name: 'Pröva himlen' }).click();
    await page.waitForSelector('.horizon-dialog', { state: 'detached' });
    for (let frame = 0; frame < 3; frame++) {
      await page.waitForTimeout(1100);
      await page.screenshot({
        path: path.join(out, `${name}-opening-${frame}.png`),
      });
    }
    await page.screenshot({ path: path.join(out, `${name}-opening.png`) });
    await page.waitForFunction(() =>
      document
        .querySelector('.horizon-story p')
        .textContent.includes('Stenen stannar'),
    );
    await page.screenshot({ path: path.join(out, `${name}-open.png`) });
    await page.reload();
    await page.waitForFunction(() =>
      document
        .querySelector('.horizon-story p')
        .textContent.includes('Stenen stannar'),
    );
    await page.getByRole('button', { name: 'Porten', exact: true }).click();
    assert(
      (await page.locator('.horizon-dialog').textContent()).includes(
        'Här slutar experimentet',
      ),
    );
    await page.getByRole('button', { name: '← Tillbaka' }).click();
    await page.getByRole('button', { name: 'Starta om experimentet' }).click();
    await page.reload();
    await page.waitForFunction(
      () => !document.querySelector('[data-action="mechanism"]').disabled,
    );
    await page.getByRole('button', { name: 'Mekanismen', exact: true }).click();
    assert.equal(await page.locator('output').first().textContent(), '0 steg');
    await page.getByRole('button', { name: '← Tillbaka' }).click();
    if (name !== 'desktop') {
      // A drag across an interactive object must not open its close-up.
      const touch = await context.newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: width / 2, y: height / 2 }],
      });
      for (let step = 1; step <= 12; step++)
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: width / 2 + step * 7.5, y: height / 2 }],
        });
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await touch.detach();
      assert.equal(await page.locator('.horizon-dialog').count(), 0);
      await page.screenshot({ path: path.join(out, `${name}-panned.png`) });
      await page.getByRole('button', { name: 'Mekanismen', exact: true }).tap();
      await page.getByRole('button', { name: '← Tillbaka' }).tap();
    }
    // Keyboard close is routed through the modal and restores the room.
    await page.getByRole('button', { name: 'Mekanismen', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.horizon-dialog').count(), 0);
    await page.getByRole('button', { name: 'Meny', exact: true }).click();
    await page.waitForSelector('.horizon-ui', { state: 'detached' });
    report.push({
      name,
      width,
      height,
      checks:
        'layout, clue, puzzle, close/reopen, partial and solved reload, reset, door sequence, drag, menu',
    });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(out, 'verification.json'),
    JSON.stringify({ report, errors }, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
