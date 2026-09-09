import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { controlWiring } from '../public/wiring.js';

const realFetch = globalThis.fetch;

test('local preview serves the original spindle and shares reported state', { timeout: 12000 }, async t => {
  const { startPreview } = await import('../scripts/preview.mjs');
  const server = await startPreview(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const abort = new AbortController();
  t.after(() => {
    abort.abort();
    server.close();
    server.closeAllConnections();
    globalThis.fetch = realFetch;
  });
  const request = path => realFetch(base + path, { signal: abort.signal });
  const firmware = await readFile(new URL('../firmware/doorOpener/doorOpener.ino', import.meta.url), 'utf8');
  for (const wire of controlWiring.filter(wire => wire.pin !== 'GND')) {
    assert.match(firmware, new RegExp(`const int ${wire.input} = ${wire.pin.slice(1)};`));
  }
  assert.ok(controlWiring.some(wire => wire.pin === 'GND' && wire.input === 'GND'));
  assert.equal((await (await request('/auth-status')).json()).preview, true);
  const command = action => realFetch(base + '/command', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: action }), signal: abort.signal,
  });
  for (const [url, file] of [['/models/spindle.stl', 'motor-spindle-final-optimized.stl'], ['/models/base.stl', 'base.stl']]) {
    const source = await readFile(new URL(`../hardware/models/${file}`, import.meta.url));
    assert.deepEqual(Buffer.from(await (await request(url)).arrayBuffer()), source);
  }
  for (const path of ['/mechanism.js', '/vendor/three/three.module.js', '/vendor/three/three.core.js', '/vendor/loaders/STLLoader.js', '/vendor/controls/OrbitControls.js', '/assets/favicon.png']) {
    assert.equal((await request(path)).status, 200, path);
  }
  await assert.rejects(fetch('https://example.com'), /External requests are disabled/);
  const readers = await Promise.all([0, 1].map(async () => (await request('/events')).body.getReader()));
  async function state(reader, expected) {
    let buffer = '';
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const { value, done } = await reader.read();
      assert.equal(done, false);
      buffer += new TextDecoder().decode(value);
      const messages = buffer.split('\n\n');
      buffer = messages.pop();
      for (const message of messages) {
        if (message.startsWith('data: ') && JSON.parse(message.slice(6)).doorOpen === expected) return;
      }
    }
    assert.fail('Controller state was not reported');
  }
  await Promise.all(readers.map(reader => state(reader, false)));
  assert.equal((await command('pulse')).status, 200);
  assert.equal((await (await request('/status')).json()).doorOpen, false, 'Publishing does not imply the handle has moved');
  await Promise.all(readers.map(reader => state(reader, true)));
  const heldAt = Date.now();
  await Promise.all(readers.map(reader => state(reader, false)));
  assert.ok(Date.now() - heldAt >= 5000, 'Both viewers observe the device-owned hold before release');
});
