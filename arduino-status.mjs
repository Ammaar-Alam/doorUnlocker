import { connect } from 'mqtt';
import { Decoder } from 'cbor-x';
import jwt from 'jsonwebtoken';

const decoder = new Decoder({ mapsAsObjects: true });

export function decodeDoorUpdate(payload) {
  if (payload.length > 65536) throw new Error('Arduino update is too large');
  const entries = decoder.decode(payload);
  if (!Array.isArray(entries)) throw new Error('Invalid Arduino update');
  const update = { doorOpen: null, telemetry: null };
  for (const record of entries) {
    const entry = record instanceof Map ? Object.fromEntries(record) : record;
    const name = entry?.n ?? entry?.[0];
    if (name === 'doorOpen') {
      const value = entry.vb ?? entry[4];
      if (typeof value === 'boolean') update.doorOpen = value;
    } else if (name === 'doorTelemetry') {
      update.telemetry = decodeTelemetry(entry.vs ?? entry[3]);
    }
  }
  return update;
}

function decodeTelemetry(value) {
  if (typeof value !== 'string' || value.length > 256) return null;
  try {
    const data = JSON.parse(value);
    if (!Number.isInteger(data?.uptime_ms) || data.uptime_ms < 0 || data.uptime_ms > 0xffffffff ||
        !Number.isInteger(data.connected) || data.connected < 0 || data.connected > 4 ||
        !Array.isArray(data.phones) || data.phones.length > data.connected) return null;
    const slots = new Set();
    const phones = [];
    for (const phone of data.phones) {
      if (!Number.isInteger(phone?.slot) || phone.slot < 1 || phone.slot > 4 || slots.has(phone.slot) ||
          typeof phone.near !== 'boolean' || (phone.rssi !== null &&
          (!Number.isInteger(phone.rssi) || phone.rssi < -127 || phone.rssi > 20))) return null;
      slots.add(phone.slot);
      phones.push({ slot: phone.slot, rssi: phone.rssi, near: phone.near });
    }
    return { uptime_ms: data.uptime_ms, connected: data.connected, phones };
  } catch {
    return null;
  }
}

// Arduino's user broker publishes SenML CBOR on the Thing output topic
export function startArduinoStatus(thingId, getToken, onValue, onDisconnect, onTelemetry) {
  let client;
  let retry;
  let refresh;
  let stopped = false;

  async function open() {
    try {
      const token = await getToken();
      if (stopped) return;
      const claims = jwt.decode(token);
      const userId = claims?.['http://arduino.cc/id'];
      if (!userId || !claims.exp) throw new Error('Arduino token has no broker identity');
      const connection = client = connect('wss://wss.iot.arduino.cc:8443/mqtt', {
        username: userId, password: token, clientId: `${userId}:${Date.now()}`,
        protocolVersion: 4, keepalive: 30, reconnectPeriod: 0, connectTimeout: 8000,
      });
      connection.on('connect', () => connection.subscribe(`/a/t/${thingId}/e/o`, { qos: 1 }, (error, grants) => {
        if (error || !grants?.length || grants.some(grant => grant.qos > 1)) connection.end(true);
        else console.log("Live Arduino status connected");
      }));
      connection.on('message', (topic, payload, packet) => {
        if (packet.retain) return;
        try {
          const update = decodeDoorUpdate(payload);
          if (update.doorOpen !== null) onValue(update.doorOpen);
          if (update.telemetry !== null) onTelemetry?.(update.telemetry);
        } catch (error) {
          console.warn('Invalid live door status:', error.message);
        }
      });
      connection.on('error', error => console.warn('Live door connection:', error.message));
      connection.on('close', reconnect);
      refresh = setTimeout(() => connection.end(true), Math.max(1000, claims.exp * 1000 - Date.now() - 15000));
    } catch (error) {
      console.warn('Live door connection unavailable:', error.message);
      reconnect();
    }
  }

  function reconnect() {
    clearTimeout(refresh);
    onDisconnect();
    if (!stopped && !retry) retry = setTimeout(() => { retry = null; void open(); }, 3000);
  }

  void open();
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearTimeout(refresh);
    client?.end(true);
  };
}
