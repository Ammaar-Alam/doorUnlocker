import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');

async function website({ confirm = true, fail = false, pollDelays = [], bodyDelays = [] } = {}) {
  const elements = new Map();
  const listeners = new Map();
  let now = 0, posts = 0, polls = 0, stream;
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      listeners: new Map(), style: {},
      addEventListener(name, callback) { this.listeners.set(name, callback); },
      setAttribute(name, value) { this[name] = value; },
    });
    return elements.get(id);
  };
  const waitForNetwork = (delay, signal) => {
    now = Math.min(now + delay, signal.deadline);
    if (now >= signal.deadline) throw new Error('Request timed out');
  };
  const document = {
    hidden: false, body: { dataset: {} },
    getElementById: element,
    addEventListener(name, callback) { listeners.set(name, callback); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); },
  };
  vm.runInNewContext(source, {
    document, location: { hostname: 'door.ammaaralam.com', protocol: 'https:' },
    window: { addEventListener() {} },
    CustomEvent: class { constructor(type, { detail }) { Object.assign(this, { type, detail }); } },
    EventSource: class { constructor() { stream = this; } close() {} },
    AbortSignal: { timeout: ms => ({ deadline: now + ms }) }, performance: { now: () => now },
    setInterval() { return 1; }, clearInterval() {},
    setTimeout(callback, ms) { now += ms; queueMicrotask(callback); },
    fetch: async (path, options) => {
      let data;
      if (path === '/auth-status') data = { authRequired: false, authenticated: false };
      else if (path === '/command') {
        posts++;
        if (fail) throw new Error('Network failed');
        data = { ok: true };
      } else if (path === '/status') {
        polls++;
        waitForNetwork(pollDelays[polls - 1] ?? 0, options.signal);
        assert.equal(element('doorToggle').disabled, true, 'Controls remain disabled during confirmation');
        data = { doorOpen: confirm && polls >= 3, online: true, updatedAt: confirm && polls >= 3 ? 'new' : 'old' };
      } else throw new Error(`Unexpected request: ${path}`);
      return { ok: true, json: async () => {
        if (path === '/status') waitForNetwork(bodyDelays[polls - 1] ?? 0, options.signal);
        return data;
      } };
    },
  });
  listeners.get('DOMContentLoaded')();
  await new Promise(setImmediate);
  stream.onmessage({ data: JSON.stringify({ doorOpen: false, online: true, updatedAt: 'old' }) });
  return { element, click: () => element('doorToggle').listeners.get('click')(), posts: () => posts, polls: () => polls, elapsed: () => now };
}

test('website waits through cached state and suppresses overlapping commands', async () => {
  const page = await website();
  const first = page.click();
  await page.click();
  await first;
  assert.equal(page.posts(), 1);
  assert.equal(page.polls(), 3);
  assert.equal(page.element('doorToggle').disabled, false);
  assert.equal(page.element('door-state').textContent, 'Open');
});

test('website makes unconfirmed completion explicit without resending', async () => {
  for (const options of [{ confirm: false }, { fail: true }]) {
    const page = await website(options);
    await page.click();
    assert.equal(page.posts(), 1);
    assert.equal(page.element('door-state').textContent, 'Not confirmed');
    assert.equal(page.element('control-feedback').hidden, false);
  }
});


test('confirmation deadline bounds slow headers and response bodies', async () => {
  for (const delays of [
    { pollDelays: [Infinity] },
    { pollDelays: [11700, Infinity] },
    { pollDelays: [11950] },
    { bodyDelays: [Infinity] },
  ]) {
    const page = await website({ confirm: false, ...delays });
    await page.click();
    assert.equal(page.posts(), 1, 'An uncertain command is never resent');
    assert.equal(page.elapsed(), 12000, 'Polling and sleep cannot extend the confirmation deadline');
    assert.equal(page.element('doorToggle')['aria-busy'], 'false');
    assert.equal(page.element('control-feedback').hidden, false);
  }
});
