async function checkMechanism(userPage) {
  const context = await userPage.context().browser().newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  try {
    const errors = [];
    const captureError = error => errors.push(error.message);
    page.on('pageerror', captureError);
    await page.goto('http://localhost:3107');
    const auth = await page.evaluate(async () => (await fetch('/auth-status')).json());
    if (!auth.preview) throw new Error('This check requires the simulated controller');
    await page.evaluate(() => {
      window.__doorCheckFrame = window.requestAnimationFrame;
      window.requestAnimationFrame = callback => window.__doorCheckFrame(time => callback(time - 32));
    });
    await page.request.post('http://localhost:3107/close');
    await page.waitForFunction(() => document.querySelector('canvas').dataset.ready === 'true' && document.body.dataset.doorState === 'closed');
    await page.setViewportSize({ width: 390, height: 680 });
    const canvas = await page.locator('canvas').boundingBox();
    await page.mouse.move(canvas.x + 90, canvas.y + 150);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(250);
    if (await page.evaluate(() => document.documentElement.scrollHeight > innerHeight && scrollY < 10)) errors.push('Viewer swallowed page scrolling');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(100);
    await page.evaluate(() => scrollTo(0, 0));
    const point = await page.evaluate(() => {
      const label = document.querySelector('[aria-label="Inspect L298N driver"]');
      const index = [...document.querySelectorAll('.part-label')].indexOf(label);
      const dot = document.querySelectorAll('#annotations circle')[index];
      const rect = document.querySelector('canvas').getBoundingClientRect();
      return { x: rect.x + Number(dot.getAttribute('cx')) - 8, y: rect.y + Number(dot.getAttribute('cy')) };
    });
    await page.mouse.click(point.x, point.y);
    if (await page.locator('#part-select').inputValue() !== 'driver') errors.push('Clicking the driver mesh did not select it');
    await page.getByRole('heading', { name: 'L298N driver', exact: true }).waitFor();
    for (const part of ['nano', 'breadboard']) {
      await page.selectOption('#part-select', part);
      await page.waitForTimeout(450);
      if (await page.evaluate(() => {
        const visible = [...document.querySelectorAll('.part-description, .drawing-footer, .control-panel, .page-footer')];
        return document.documentElement.scrollHeight > innerHeight + 1 || visible.some(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.bottom > innerHeight || element.scrollHeight > element.clientHeight + 1;
        });
      })) errors.push('Expanded inspector does not fit the viewport');
      if (await page.evaluate(() => {
        const bottom = document.querySelector('canvas').getBoundingClientRect().bottom;
        return [...document.querySelectorAll('.part-label:not([hidden])')].some(label => label.getBoundingClientRect().bottom > bottom);
      })) errors.push('A part label is clipped by the diagram');
    }
    for (const [action, target] of [['Open door', '1.000'], ['Close door', '0.000']]) {
      await page.getByRole('button', { name: action, exact: true }).click();
      try {
        await page.waitForFunction(() => {
          const canvas = document.querySelector('canvas');
          return canvas.dataset.flow === 'active' && Number(canvas.dataset.position) > 0 && Number(canvas.dataset.position) < 1;
        }, null, { timeout: 3500 });
        await page.waitForFunction(value => document.querySelector('canvas').dataset.position === value, target, { timeout: 2000 });
      } catch { errors.push(`${action} did not animate`); }
    }
    await page.request.post('http://localhost:3107/close');
    await page.evaluate(() => { window.requestAnimationFrame = window.__doorCheckFrame; delete window.__doorCheckFrame; });
    page.off('pageerror', captureError);
    if (errors.length) throw new Error([...new Set(errors)].join('; '));
    return { viewportFit: 'passed', scroll: 'passed', meshSelection: 'passed', animationWithEarlyFrame: 'passed' };
  } finally {
    await context.close();
  }
}
