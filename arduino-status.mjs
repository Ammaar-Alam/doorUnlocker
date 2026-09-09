import { connect } from 'mqtt';
import { Decoder } from 'cbor-x';
import jwt from 'jsonwebtoken';

const decoder = new Decoder({ mapsAsObjects: true });

export function decodeDoorState(payload) {
  if (payload.length > 65536) throw new Error('Arduino update is too large');
  const entries = decoder.decode(payload);
  if (!Array.isArray(entries)) throw new Error('Invalid Arduino update');
  for (const record of entries) {
    const entry = record instanceof Map ? Object.fromEntries(record) : record;
    if ((entry?.n ?? entry?.[0]) !== 'doorOpen') continue;
    const value = entry.vb ?? entry[4];
    if (typeof value === 'boolean') return value;
  }
  return null;
}

// Arduino's user broker publishes SenML CBOR on the Thing output topic
export function startArduinoStatus(thingId, getToken, onValue, onDisconnect) {
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
          const value = decodeDoorState(payload);
          if (value !== null) onValue(value);
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
