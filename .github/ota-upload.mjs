import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, statSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

function cloud(...args) {
  return JSON.parse(execFileSync('arduino-cloud-cli', [...args, '--format', 'json'], {
    encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'],
  }));
}

async function upload() {
  if (process.env.GITHUB_SHA) {
    execFileSync('git', ['fetch', 'origin', 'main'], { timeout: 30000, stdio: 'pipe' });
    try {
      execFileSync('git', ['diff', '--quiet', process.env.GITHUB_SHA, 'FETCH_HEAD', '--', 'firmware/', '.github/ota-upload.mjs', '.github/workflows/checks.yml']);
    } catch (error) {
      if (error.status !== 1) throw error;
      console.log('Skipping superseded firmware revision');
      return;
    }
  }
  const binary = process.argv[2];
  if (!binary || !statSync(binary).isFile()) throw new Error('A firmware binary is required');
  const header = readFileSync('firmware/doorOpener/thingProperties.h', 'utf8');
  const deviceId = header.match(/DEVICE_LOGIN_NAME\[\]\s*=\s*"([0-9a-f-]{36})"/)?.[1];
  if (!deviceId) throw new Error('Missing device ID in thingProperties.h');
  const device = cloud('device', 'list', '--device-ids', deviceId).find(device => device.id === deviceId);
  if (!device || device.fqbn !== 'arduino:esp32:nano_nora' || device.status !== 'ONLINE') {
    throw new Error('The configured Nano ESP32 must be online before updating');
  }

  const request = cloud('ota', 'upload', '--device-id', deviceId, '--file', binary);
  if (!request.id || request.device_id !== deviceId || Array.isArray(request)) {
    throw new Error('Arduino Cloud did not schedule this firmware upload');
  }
  console.log(`OTA ${request.id} scheduled`);
  for (let attempt = 0; attempt < 120; attempt++) {
    const result = cloud('ota', 'status', '--ota-id', request.id);
    if (result.id !== request.id || result.device_id !== deviceId) throw new Error('Unexpected OTA status response');
    console.log(`OTA ${request.id}: ${result.status}`);
    if (result.status === 'succeeded') {
      if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Firmware revision: ${process.env.GITHUB_SHA}\n\nArduino OTA: ${request.id} — succeeded\n`);
      }
      return;
    }
    if (result.ended_at || ['failed', 'cancelled', 'expired', 'skipped'].includes(result.status)) {
      throw new Error(`OTA ${result.status}: ${result.error_reason || 'Update did not complete'}`);
    }
    await setTimeout(5000);
  }
  throw new Error(`Timed out waiting for OTA ${request.id}; inspect its status before retrying`);
}

upload().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
