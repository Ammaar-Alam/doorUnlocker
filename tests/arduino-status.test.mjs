import test from 'node:test';
import assert from 'node:assert/strict';
import { encode } from 'cbor-x';
import { decodeDoorUpdate } from '../arduino-status.mjs';

test('Arduino SenML updates preserve booleans and ignore other properties', () => {
  const decodeDoorState = payload => decodeDoorUpdate(payload).doorOpen;
  assert.equal(decodeDoorState(encode([new Map([[0, 'doorOpen'], [4, true]])])), true);
  assert.equal(decodeDoorState(encode([new Map([[0, 'doorOpen'], [4, false]])])), false);
  assert.equal(decodeDoorState(encode([{ n: 'doorOpen', vb: false }])), false);
  assert.equal(decodeDoorState(encode([{ n: 'doorCommand', vs: 'open' }])) , null);
  assert.equal(decodeDoorState(encode([{ n: 'doorOpen', vb: 'false' }])), null);
  assert.throws(() => decodeDoorState(Buffer.alloc(65537)));
  assert.deepEqual(decodeDoorUpdate(encode([{ n: "doorPairingCode", vs: "482619" }])), { doorOpen: null, telemetry: null }, "PIN updates never enter status or telemetry logs");
});

test('RSSI telemetry preserves per-phone readings without leaking arbitrary fields', () => {
  const expected = { uptime_ms: 1000, connected: 2, phones: [
    { slot: 1, rssi: -45, near: true }, { slot: 2, rssi: null, near: false },
  ] };
  const decode = value => decodeDoorUpdate(encode([
    { n: 'doorTelemetry', vs: value }, { n: 'doorOpen', vb: false },
  ]));
  assert.deepEqual(decode(JSON.stringify(expected)), { doorOpen: false, telemetry: expected });
  const disconnected = { uptime_ms: 60000, connected: 0, phones: [] };
  assert.deepEqual(decode(JSON.stringify(disconnected)).telemetry, disconnected);
  assert.deepEqual(decodeDoorUpdate(encode([new Map([[0, 'doorTelemetry'], [3, JSON.stringify(expected)]])])).telemetry, expected);
  assert.deepEqual(decode(JSON.stringify({ ...expected, extra: 'omit', phones: [
    { ...expected.phones[0], extra: 'omit' }, expected.phones[1],
  ] })).telemetry, expected);
  for (const value of ['{', 'null', 'x'.repeat(257), JSON.stringify({ ...expected, uptime_ms: -1 }),
    JSON.stringify({ ...expected, connected: 0 }),
    JSON.stringify({ ...expected, phones: [{ slot: 1, rssi: 127, near: false }] }),
    JSON.stringify({ ...expected, phones: [expected.phones[0], expected.phones[0]] })]) {
    assert.deepEqual(decode(value), { doorOpen: false, telemetry: null });
  }
});
