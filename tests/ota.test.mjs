import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('OTA waits for the requested device update and rejects failures and stale revisions', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'door-ota-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bin = join(directory, 'bin');
  await mkdir(bin);
  await mkdir(join(directory, 'firmware/doorOpener'), { recursive: true });
  const device = '185a1726-9851-42bd-8c23-8ecd6f1e05ed';
  await writeFile(join(directory, 'firmware/doorOpener/thingProperties.h'), `const char DEVICE_LOGIN_NAME[] = "${device}";`);
  const binary = join(directory, 'firmware.bin');
  await writeFile(binary, 'test binary');
  const log = join(directory, 'calls'), summary = join(directory, 'summary');
  const revision = 'a'.repeat(40);
  await writeFile(join(bin, 'git'), '#!/bin/sh\nif [ "$1" = diff ] && [ "$TEST_CHANGED" = true ]; then exit 1; fi\nexit 0\n', { mode: 0o755 });
  await writeFile(join(bin, 'arduino-cloud-cli'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const mode = process.env.TEST_MODE;
const previous = fs.readFileSync(process.env.TEST_LOG, 'utf8');
fs.appendFileSync(process.env.TEST_LOG, args.slice(0, 2).join(' ') + '\\n');
let result = {id:'ota-1', device_id:'${device}', status:'pending'};
if (args[0] === 'device') result = {id:'${device}', fqbn:mode === 'wrong-board' ? 'other' : 'arduino:esp32:nano_nora', status:mode === 'offline' ? 'OFFLINE' : 'ONLINE'};
else if (args[1] === 'upload' && mode === 'conflict') result = [{status:'skipped'}, result];
else if (args[1] === 'status') {
  if (mode === 'failed') result = {...result, status:'failed', error_reason:'download failed'};
  else if (mode === 'mismatch') result = {...result, id:'another-ota', status:'succeeded'};
  else if (mode === 'invalid') { console.log('not JSON'); process.exit(0); }
  else if (mode !== 'pending' || previous.includes('ota status')) result.status = 'succeeded';
}
console.log(JSON.stringify(result));
`, { mode: 0o755 });

  const run = async (mode, head = revision) => {
    await writeFile(log, '');
    await writeFile(summary, '');
    return spawnSync(process.execPath, [fileURLToPath(new URL('../.github/ota-upload.mjs', import.meta.url)), binary], {
      cwd: directory, encoding: 'utf8', timeout: 15000,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_SHA: revision, GITHUB_STEP_SUMMARY: summary, TEST_CHANGED: String(head !== revision), TEST_MODE: mode, TEST_LOG: log },
    });
  };
  assert.equal((await run('success', 'b'.repeat(40))).status, 0);
  assert.equal(await readFile(log, 'utf8'), '', 'Superseded commits never contact Arduino');
  for (const mode of ['offline', 'wrong-board', 'conflict', 'failed', 'mismatch', 'invalid']) {
    const result = await run(mode);
    assert.equal(result.status, 1, mode);
    assert.equal(await readFile(summary, 'utf8'), '', mode);
    const calls = await readFile(log, 'utf8');
    assert.equal(calls.split('ota upload').length - 1, ['offline', 'wrong-board'].includes(mode) ? 0 : 1, mode);
  }
  const result = await run('pending');
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await readFile(log, 'utf8')).split('ota status').length - 1, 2);
  assert.match(await readFile(summary, 'utf8'), /ota-1.*succeeded/);
});
