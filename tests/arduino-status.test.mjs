import test from 'node:test';
import assert from 'node:assert/strict';
import { encode } from 'cbor-x';
import { decodeDoorState } from '../arduino-status.mjs';

test('Arduino SenML updates preserve booleans and ignore other properties', () => {
  assert.equal(decodeDoorState(encode([new Map([[0, 'doorOpen'], [4, true]])])), true);
  assert.equal(decodeDoorState(encode([new Map([[0, 'doorOpen'], [4, false]])])), false);
  assert.equal(decodeDoorState(encode([{ n: 'doorOpen', vb: false }])), false);
  assert.equal(decodeDoorState(encode([{ n: 'doorCommand', vs: 'pulse' }])) , null);
  assert.equal(decodeDoorState(encode([{ n: 'doorOpen', vb: 'false' }])), null);
  assert.throws(() => decodeDoorState(Buffer.alloc(65537)));
});
