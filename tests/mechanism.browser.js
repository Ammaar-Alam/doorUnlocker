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
    const resizeFrames = await page.evaluate(async () => {
      const canvas = document.querySelector('canvas');
      const gl = canvas.getContext('webgl2');
      let size = `${canvas.width}:${canvas.height}`;
      const frames = [];
      const observer = new ResizeObserver(() => {
        const next = `${canvas.width}:${canvas.height}`;
        if (next === size) return;
        size = next;
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        frames.push(pixels.some((value, index) => index % 4 === 3 && value > 0));
      });
      observer.observe(document.querySelector('#mechanism-view'));
      document.querySelector('[aria-label="Inspect L298N driver"]').click();
      await new Promise(resolve => setTimeout(resolve, 500));
      document.querySelector('#close-part').click();
      await new Promise(resolve => setTimeout(resolve, 500));
      observer.disconnect();
      return frames;
    });
    if (!resizeFrames.length || resizeFrames.includes(false)) errors.push('The model disappears during inspector resizing');
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
    await page.route('**/command', async route => {
      await page.waitForTimeout(350);
      await route.continue();
    });
    for (const [action, target] of [['Open door', '1.000'], ['Close door', '0.000']]) {
      await page.getByRole('button', { name: action, exact: true }).click();
      await page.waitForTimeout(180);
      if (await page.locator('canvas').getAttribute('data-flow') !== 'active') errors.push(`${action} waits for reported completion before animating`);
      if (await page.locator('#doorToggle').getAttribute('aria-busy') !== 'true') errors.push('Motion does not keep the control busy');
      if (await page.locator('body').getAttribute('data-door-state') !== (target === '1.000' ? 'closed' : 'open')) errors.push('Animation changed the reported door state');
      try {
        await page.waitForFunction(() => {
          const canvas = document.querySelector('canvas');
          return canvas.dataset.flow === 'active' && Number(canvas.dataset.position) > 0 && Number(canvas.dataset.position) < 1;
        }, null, { timeout: 3500 });
        await page.waitForFunction(value => document.querySelector('canvas').dataset.position === value, target, { timeout: 2000 });
        await page.waitForFunction(state => document.body.dataset.doorState === state, target === '1.000' ? 'open' : 'closed');
        await page.waitForTimeout(120);
        if (await page.locator('canvas').getAttribute('data-flow') !== 'idle') errors.push('Confirmation replayed the completed animation');
      } catch { errors.push(`${action} did not animate`); }
      await page.locator('.adjustment-details').evaluate(details => { details.open = true; });
      await page.getByRole('button', { name: target === '1.000' ? 'Force open' : 'Force close', exact: true }).click();
      await page.waitForTimeout(180);
      if (await page.locator('canvas').getAttribute('data-flow') !== 'active' || await page.locator('canvas').getAttribute('data-position') !== target) errors.push('Same-position string adjustment did not animate the electrical flow');
      await page.waitForFunction(() => document.querySelector('canvas').dataset.flow === 'idle');
      await page.waitForTimeout(400);
    }
    await page.unroute('**/command');
    await page.route('**/command', async route => {
      await page.waitForTimeout(350);
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Controller unavailable' }) });
    });
    await page.getByRole('button', { name: 'Open door', exact: true }).click();
    await page.waitForTimeout(180);
    if (await page.locator('canvas').getAttribute('data-flow') !== 'active') errors.push('A pending request did not start motion');
    await page.getByText('Controller unavailable', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('canvas').dataset.flow === 'idle');
    if (await page.locator('canvas').getAttribute('data-position') !== '0.000' || await page.locator('body').getAttribute('data-door-state') !== 'closed') errors.push('Rejected command did not restore the reported pose');
    await page.unroute('**/command');
    await page.selectOption('#part-select', '');
    await page.setViewportSize({ width: 844, height: 390 });
    for (const selector of ['.doorbell-details', '.adjustment-details']) {
      await page.locator(selector).evaluate(details => { details.open = true; });
      const panel = await page.locator('.control-panel').boundingBox();
      await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height / 2);
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(250);
      if (!await page.locator(`${selector} button`).first().evaluate(button => {
        const bounds = button.getBoundingClientRect();
        const panel = button.closest('.control-panel').getBoundingClientRect();
        return bounds.top >= panel.top && bounds.bottom <= panel.bottom && button.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
      })) errors.push('Expanded controls are unreachable in a short viewport');
    }
    await page.request.post('http://localhost:3107/close');
    await page.evaluate(() => { window.requestAnimationFrame = window.__doorCheckFrame; delete window.__doorCheckFrame; });
    page.off('pageerror', captureError);
    if (errors.length) throw new Error([...new Set(errors)].join('; '));
    return { resizeFrames: resizeFrames.length, blankFrames: 0, viewportFit: 'passed', scroll: 'passed', shortViewportControls: 'passed', meshSelection: 'passed', immediateAnimation: 'passed', forceFlow: 'passed', rejectedCommand: 'passed', animationWithEarlyFrame: 'passed' };
  } finally {
    await context.close();
  }
}
