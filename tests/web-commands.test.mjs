import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/script.js', import.meta.url), 'utf8');

async function website({ confirm = true, fail = false } = {}) {
  const elements = new Map();
  const listeners = new Map();
  let now = 0, posts = 0, polls = 0, stream;
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      listeners: new Map(), style: {},
      addEventListener(name, callback) { this.listeners.set(name, callback); },
      setAttribute() {},
    });
    return elements.get(id);
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
    AbortSignal, performance: { now: () => now },
    setInterval() { return 1; }, clearInterval() {},
    setTimeout(callback, ms) { now += ms; queueMicrotask(callback); },
    fetch: async path => {
      let data;
      if (path === '/auth-status') data = { authRequired: false, authenticated: false };
      else if (path === '/command') {
        posts++;
        if (fail) throw new Error('Network failed');
        data = { ok: true };
      } else if (path === '/status') {
        polls++;
        assert.equal(element('doorToggle').disabled, true, 'Controls remain disabled during confirmation');
        data = { doorOpen: confirm && polls >= 3, online: true, updatedAt: confirm && polls >= 3 ? 'new' : 'old' };
      } else throw new Error(`Unexpected request: ${path}`);
      return { ok: true, json: async () => data };
    },
  });
  listeners.get('DOMContentLoaded')();
  await new Promise(setImmediate);
  stream.onmessage({ data: JSON.stringify({ doorOpen: false, online: true, updatedAt: 'old' }) });
  return { element, click: () => element('doorToggle').listeners.get('click')(), posts: () => posts, polls: () => polls };
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
