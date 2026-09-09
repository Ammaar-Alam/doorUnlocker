import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

// the preview never loads credentials or connects to Arduino
process.env.DOTENV_CONFIG_PATH = '/dev/null';
Object.assign(process.env, {
  AUTH_REQUIRED: 'false', PASSWORD: 'preview', SECRET_KEY: crypto.randomUUID(),
  ADMIN_TOKEN: crypto.randomUUID(), THING_ID: 'preview', PROPERTY_ID: 'position',
  COMMAND_PROPERTY_ID: 'command', CLIENT_ID: 'preview', CLIENT_SECRET: 'preview',
  STATUS_POLL_INTERVAL_MS: '100', HOST: '127.0.0.1',
});

let open = false;
let requestedOpen = false;
let pulse = false;
let pulseTimer;
let strokeTimer;
function move(next, force = false) {
  requestedOpen = next;
  if (strokeTimer || (open === next && !force)) return;
  strokeTimer = setTimeout(() => {
    strokeTimer = null;
    open = next;
    if (requestedOpen !== open) move(requestedOpen);
    else if (pulse && open) hold();
  }, next ? 970 : 650);
}
function hold() {
  clearTimeout(pulseTimer);
  pulseTimer = setTimeout(() => { pulse = false; move(false); }, 5000);
}
globalThis.fetch = async (url, options = {}) => {
  const path = String(url);
  if (!path.startsWith('https://api2.arduino.cc/')) throw new Error('External requests are disabled in preview');
  if (path.endsWith('/clients/token')) return Response.json({ access_token: 'preview', expires_in: 3600 });
  if (path.endsWith('/publish')) {
    const action = JSON.parse(options.body).value.split(':')[0];
    const force = action.startsWith('force-');
    if (!(force && strokeTimer)) {
      const next = !action.includes('close');
      if (!next) { pulse = false; clearTimeout(pulseTimer); }
      if (action === 'pulse' && !pulse) {
        pulse = true;
        if (open && !strokeTimer) hold();
      }
      move(next, force);
    }
    return new Response(null, { status: 204 });
  }
  if (path.endsWith('/things/preview')) return Response.json({ device_id: 'preview' });
  if (path.endsWith('/devices/preview')) return Response.json({ device_status: 'ONLINE' });
  if (path.endsWith('/properties/position')) return Response.json({ last_value: open, value_updated_at: new Date().toISOString() });
  throw new Error('Unexpected preview request');
};

export async function startPreview(port = 3107) {
  const { app, startServer } = await import('../server.mjs');
  app.locals.preview = true;
  const server = startServer(port);
  server.on('close', () => { clearTimeout(pulseTimer); clearTimeout(strokeTimer); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await startPreview();
  server.on('listening', () => console.log('Preview: http://localhost:3107 — simulated controller, no hardware commands'));
}
