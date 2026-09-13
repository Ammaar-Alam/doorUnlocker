import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { once } from "node:events";

process.env.AUTH_REQUIRED = "false";
process.env.PASSWORD = crypto.randomUUID();
process.env.SECRET_KEY = crypto.randomUUID();
process.env.ADMIN_TOKEN = crypto.randomUUID();
process.env.THING_ID = "test-thing";
process.env.PROPERTY_ID = "test-property";
process.env.COMMAND_PROPERTY_ID = "test-command";
process.env.CLIENT_ID = "test-client";
process.env.CLIENT_SECRET = crypto.randomUUID();
process.env.STATUS_POLL_INTERVAL_MS = "20";
process.env.ARDUINO_HTTP_TIMEOUT_MS = "1500";

const realFetch = globalThis.fetch;
let doorOpen = false;
let online = true;
let propertyValue = false;
let failPublish = false;
let refreshToken = false;
let tokenRequests = 0;
let cloudReads = 0;
let publishes = [];
let publishGate = null;
let stallBody = false;
let limitedPath = "";
let limitsRemaining = 0;
let retryAfter = "0";
let attempts = [];
let timeoutPublish = false;
let pairingCodeValue = "482619";
globalThis.fetch = async (url, options = {}) => {
  assert.ok(String(url).startsWith("https://api2.arduino.cc/"), "Only Arduino is replaced by this test");
  if (limitedPath && String(url).endsWith(limitedPath)) {
    attempts.push({ body: options.body, at: Date.now(), signal: options.signal });
    if (limitsRemaining-- > 0) return new Response(null, { status: 429, headers: retryAfter === null ? {} : { "Retry-After": retryAfter } });
  }
  if (String(url).endsWith("/clients/token")) {
    tokenRequests++;
    return Response.json({ access_token: `token-${tokenRequests}`, expires_in: 3600 });
  }
  if (refreshToken) {
    refreshToken = false;
    return new Response(null, { status: 401 });
  }
  if (String(url).endsWith("/publish")) {
    if (timeoutPublish) throw new DOMException("Publish timed out", "TimeoutError");
    if (publishGate) await publishGate;
    if (failPublish) return new Response(null, { status: 503 });
    publishes.push(JSON.parse(options.body).value);
    return new Response(null, { status: 204 });
  }
  cloudReads++;
  if (String(url).endsWith("/test-thing/properties")) return Response.json([{ name: "doorPairingCode", last_value: pairingCodeValue }]);
  if (String(url).endsWith("/test-thing")) return Response.json({ device_id: "test-device" });
  if (String(url).endsWith("/test-device")) return Response.json({ device_status: online ? "ONLINE" : "OFFLINE" });
  if (stallBody) {
    return { ok: true, status: 200, json: () => new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    }) };
  }
  return Response.json({ last_value: propertyValue === null ? null : doorOpen, value_updated_at: "2026-09-09T00:00:00Z" });
};

const { startServer } = await import("../server.mjs");
const server = startServer(0);
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
const request = (path, options) => realFetch(base + path, options);
const post = (path, body, headers) => request(path, {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test("door API and shared status", async t => {
  t.after(() => {
    server.close();
    server.closeAllConnections();
    globalThis.fetch = realFetch;
  });
  await delay(50);
  assert.equal(cloudReads, 0, "No background cloud polling without viewers");
  assert.equal((await request("/api/diagnostics")).status, 401, "Diagnostics remain private outside protected hours");
  const diagnosticsLogin = await post("/login", { password: process.env.PASSWORD });
  const { token: diagnosticsToken } = await diagnosticsLogin.json();
  const diagnostics = await request("/api/diagnostics", { headers: { Authorization: `Bearer ${diagnosticsToken}` } });
  assert.equal(diagnostics.status, 200);
  assert.deepEqual(await diagnostics.json(), { telemetry: null, receivedAt: null });
  assert.equal(cloudReads, 0, "Diagnostics only read the MQTT snapshot");

  for (const path of ["/open", "/close", "/command", "/emergency-close", "/api/open", "/force-open", "/force-close"]) {
    const response = await post(path, { command: "open" });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.equal((await response.json()).ok, true);
  }
  assert.ok(publishes.every(value => /^(open|close|force-open|force-close):[0-9]+:[0-9a-f-]+$/.test(value)));
  const beforeUnsupported = publishes.length;
  assert.equal((await post("/pulse", {})).status, 404);
  assert.equal((await post("/command", { command: "pulse" })).status, 400);
  assert.equal(publishes.length, beforeUnsupported);
  assert.equal(new Set(publishes).size, publishes.length);
  assert.equal(tokenRequests, 1, "OAuth token is shared across requests");
  assert.equal((await (await request("/status")).json()).doorOpen, false,
    "A successful publish must not pretend the device reported open");

  const streams = [new AbortController(), new AbortController()];
  const readings = await Promise.all(streams.map(async controller => {
    const response = await request("/events", { signal: controller.signal });
    return response.body.getReader();
  }));
  const nextState = async (reader, expected) => {
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      assert.equal(done, false);
      buffer += new TextDecoder().decode(value);
      const messages = buffer.split("\n\n");
      buffer = messages.pop();
      for (const message of messages) {
        if (message.startsWith("data: ") && JSON.parse(message.slice(6)).doorOpen === expected) return;
      }
    }
  };
  await Promise.all(readings.map(reader => nextState(reader, false)));
  doorOpen = true;
  await Promise.all(readings.map(reader => nextState(reader, true)));
  doorOpen = false;
  await Promise.all(readings.map(reader => nextState(reader, false)));
  streams.forEach(controller => controller.abort());
  await delay(50);
  const idleReads = cloudReads;
  await delay(50);
  assert.equal(cloudReads, idleReads, "Polling stops when both browsers disconnect");

  online = false;
  await delay(25);
  const beforeOffline = publishes.length;
  assert.equal((await post("/open", {})).status, 503);
  assert.equal(publishes.length, beforeOffline, "Offline open requests are not queued");
  assert.deepEqual(await (await request("/status")).json(), {
    doorOpen: null, online: false, updatedAt: "2026-09-09T00:00:00Z",
  });
  online = true;
  await delay(25);

  for (const path of ["/test-device", "/test-command/publish"]) {
    limitedPath = path;
    limitsRemaining = 1;
    attempts = [];
    await delay(25);
    assert.equal((await post("/close", {})).status, 200, `Close survives a rate-limited ${path}`);
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0].signal, attempts[1].signal, "Retries share the original request deadline");
    if (path.endsWith("publish")) assert.equal(attempts[0].body, attempts[1].body, "Retries preserve command ID and expiry");
  }
  for (const header of ["1", new Date(Date.now() + 2000).toUTCString(), null, "invalid"]) {
    retryAfter = header;
    limitsRemaining = 1;
    attempts = [];
    assert.equal((await post("/close", {})).status, 200);
    const minimum = header === "1" || header === null || header === "invalid" ? 1000 : Math.max(0, Date.parse(header) - attempts[0].at);
    assert.ok(attempts[1].at - attempts[0].at >= minimum - 10, "Retry-After or fallback delay is respected");
  }
  for (const [header, count] of [["0", 3], ["60", 1]]) {
    retryAfter = header;
    limitsRemaining = 99;
    attempts = [];
    const before = publishes.length;
    assert.equal((await post("/close", {})).status, 502);
    assert.equal(attempts.length, count, "Retries are bounded by attempts and request deadline");
    assert.equal(publishes.length, before);
  }
  limitsRemaining = 0;
  timeoutPublish = true;
  attempts = [];
  assert.equal((await post("/close", {})).status, 502);
  assert.equal(attempts.length, 1, "Ambiguous publish timeouts are not retried");
  timeoutPublish = false;
  limitedPath = "";

  let release;
  publishGate = new Promise(resolve => { release = resolve; });
  const firstCommand = post("/open", {});
  await delay(30);
  assert.equal((await post("/close", {})).status, 409);
  release();
  assert.equal((await firstCommand).status, 200);
  publishGate = null;

  failPublish = true;
  let response = await post("/open", {});
  assert.equal(response.status, 502);
  assert.equal((await response.json()).ok, false);
  failPublish = false;
  limitedPath = "/clients/token";
  retryAfter = "0";
  limitsRemaining = 1;
  attempts = [];
  refreshToken = true;
  assert.equal((await post("/close", {})).status, 200);
  assert.equal(tokenRequests, 2);
  assert.equal(attempts.length, 2, "Token requests also recover from rate limits");
  limitedPath = "";

  propertyValue = null;
  await delay(25);
  response = await request("/status");
  assert.equal(response.status, 502, "Missing status is never coerced to closed");
  propertyValue = false;
  stallBody = true;
  await delay(25);
  assert.equal((await request("/status")).status, 502, "Timeout covers reading the response body");
  stallBody = false;

  assert.equal((await post("/command", { command: "invalid" })).status, 400);
  response = await request("/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, "Invalid JSON request");
  assert.equal((await (await request("/api/missing")).json()).ok, false);

  const login = await post("/login", { password: process.env.PASSWORD });
  const { token } = await login.json();
  assert.ok(token);
  const beforePairingReads = cloudReads;
  assert.equal((await request("/api/pairing-code")).status, 401, "Pairing code is private during public hours");
  assert.equal(cloudReads, beforePairingReads, "Unauthenticated PIN requests never reach Arduino");
  const pairingHeaders = { Authorization: `Bearer ${token}` };
  const pairing = await request("/api/pairing-code", { headers: pairingHeaders });
  assert.equal(pairing.status, 200);
  assert.match(pairing.headers.get("cache-control"), /no-store/);
  assert.deepEqual(await pairing.json(), { code: pairingCodeValue });
  for (const invalid of [null, "", "12345", "1234567", "abcdef", 123456]) {
    pairingCodeValue = invalid;
    assert.equal((await request("/api/pairing-code", { headers: pairingHeaders })).status, 503);
  }
  assert.equal((await request("/api/diagnostics", { headers: pairingHeaders })).status, 200);
  assert.equal(JSON.stringify(await (await request("/api/diagnostics", { headers: pairingHeaders })).json()).includes("code"), false);
  const adminHeaders = { "X-Admin-Token": process.env.ADMIN_TOKEN };
  response = await post("/admin/set-auth-required", { enabled: "false" }, adminHeaders);
  assert.equal(response.status, 400);
  await post("/admin/set-auth-required", { enabled: true }, adminHeaders);
  assert.equal((await post("/open", {})).status, 401);
  assert.equal((await post("/open", { password: process.env.PASSWORD })).status, 200);
  assert.equal((await post("/open", {}, { Authorization: `Bearer ${token}` })).status, 200);
  assert.equal((await request("/auth-status", { headers: { Cookie: `authToken=${token}` } }).then(r => r.json())).authenticated, true);
});
