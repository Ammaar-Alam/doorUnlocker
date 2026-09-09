import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('deployment validates revisions, preserves the running release, and rolls back failed health checks', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'door-deployment-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, 'host');
  const bin = join(directory, 'bin');
  const source = join(directory, 'source');
  const log = join(directory, 'commands');
  await Promise.all([mkdir(join(root, 'doorunlocker'), { recursive: true }), mkdir(bin), mkdir(source)]);
  const old = 'a'.repeat(40), next = 'b'.repeat(40), failed = 'c'.repeat(40);
  await writeFile(join(root, 'doorunlocker', 'REVISION'), old);
  const configuration = 'DOOR_DEPLOY_TEST=retained\n';
  await writeFile(join(root, 'doorunlocker', '.env'), configuration, { mode: 0o600 });
  await writeFile(join(source, 'release.txt'), 'new application files');
  const archive = join(directory, 'release.tar.gz');
  execFileSync('tar', ['-czf', archive, '-C', directory, 'source']);
  const mocks = {
    git: 'printf "%s\\trefs/heads/main\\n" "$TEST_HEAD"',
    flock: 'exit 0',
    chown: 'exit 0',
    sleep: 'exit 0',
    systemctl: 'printf "%s\\n" "$*" >> "$TEST_LOG"',
    curl: `case "$*" in
      *codeload.github.com*) cat "$TEST_ARCHIVE" ;;
      *) if [ "$(cat "$DOOR_DEPLOY_ROOT/doorunlocker/REVISION")" = "$TEST_FAIL_HEALTH" ]; then exit 22; fi
         printf '%s' '{"preview":false,"authRequired":false}' ;;
    esac`,
    runuser: `shift 3
      printf '%s\\n' "$*" >> "$TEST_LOG"
      if [ "$1" = tar ]; then exec "$@"; fi
      if [ "$1" = node ] && [ "$TEST_FAIL_PREVIEW" = true ]; then exit 1; fi`,
  };
  for (const [name, body] of Object.entries(mocks)) await writeFile(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  const deploy = (revision, options = {}) => spawnSync('bash', [fileURLToPath(new URL('../.github/deploy.sh', import.meta.url)), ...(revision === undefined ? [] : [revision])], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, DOOR_DEPLOY_ROOT: root, TEST_HEAD: next, TEST_ARCHIVE: archive, TEST_LOG: log, ...options },
  });
  const revision = () => readFile(join(root, 'doorunlocker', 'REVISION'), 'utf8').then(value => value.trim());
  assert.equal(deploy('invalid').status, 1);
  assert.equal(deploy(undefined, { SSH_ORIGINAL_COMMAND: 'invalid' }).status, 1);
  assert.equal(deploy(old).status, 0, 'stale runs are skipped');
  assert.equal(deploy(next, { TEST_FAIL_PREVIEW: 'true' }).status, 1);
  assert.equal(await revision(), old, 'staging failures must leave the current release intact');
  const success = deploy(undefined, { SSH_ORIGINAL_COMMAND: next });
  assert.equal(success.status, 0, success.stderr);
  assert.equal(await revision(), next);
  assert.equal(await readFile(join(root, 'doorunlocker', '.env'), 'utf8'), configuration);
  assert.equal((await stat(join(root, 'doorunlocker', '.env'))).mode & 0o777, 0o600);
  assert.equal((await readFile(join(root, 'doorunlocker-previous', 'REVISION'), 'utf8')).trim(), old);
  assert.equal(deploy(next).status, 0, 'reruns succeed without another restart');
  assert.equal((await readFile(log, 'utf8')).match(/restart doorunlocker.service/g).length, 1);
  assert.equal(deploy(failed, { TEST_HEAD: failed, TEST_FAIL_HEALTH: failed }).status, 1);
  assert.equal(await revision(), next, 'failed startup restores the last healthy release');
  assert.equal(await readFile(join(root, 'doorunlocker', '.env'), 'utf8'), configuration);
  assert.equal((await readFile(join(root, 'doorunlocker-previous', 'REVISION'), 'utf8')).trim(), old);
  assert.equal((await readFile(log, 'utf8')).match(/restart doorunlocker.service/g).length, 3);
  assert.ok(!(await readdir(root)).some(name => name.startsWith('.doorunlocker-stage-')));
});
