import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('motor timing, repeat commands, early close, and clock rollover', () => {
  const directory = mkdtempSync(join(tmpdir(), 'door-controller-'));
  try {
    const executable = join(directory, 'check');
    execFileSync('c++', ['-std=c++11', '-Wall', '-Wextra', '-Werror', 'tests/door-controller.cpp', '-o', executable]);
    execFileSync(executable);
  } finally {
    rmSync(directory, { recursive: true });
  }
});
