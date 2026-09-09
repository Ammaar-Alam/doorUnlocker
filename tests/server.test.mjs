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
process.env.ARDUINO_HTTP_TIMEOUT_MS = "100";

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
globalThis.fetch = async (url, options = {}) => {
  assert.ok(String(url).startsWith("https://api2.arduino.cc/"), "Only Arduino is replaced by this test");
  if (String(url).endsWith("/clients/token")) {
    tokenRequests++;
    return Response.json({ access_token: `token-${tokenRequests}`, expires_in: 3600 });
  }
  if (refreshToken) {
    refreshToken = false;
    return new Response(null, { status: 401 });
  }
  if (String(url).endsWith("/publish")) {
    if (publishGate) await publishGate;
    if (failPublish) return new Response(null, { status: 503 });
    publishes.push(JSON.parse(options.body).value);
    return new Response(null, { status: 204 });
  }
  cloudReads++;
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

  for (const path of ["/open", "/close", "/command", "/emergency-close", "/api/open", "/pulse", "/force-open", "/force-close"]) {
    const response = await post(path, { command: "open" });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.equal((await response.json()).ok, true);
  }
  assert.ok(publishes.every(value => /^(open|close|pulse|force-open|force-close):[0-9]+:[0-9a-f-]+$/.test(value)));
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
  refreshToken = true;
  assert.equal((await post("/close", {})).status, 200);
  assert.equal(tokenRequests, 2);

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
  const adminHeaders = { "X-Admin-Token": process.env.ADMIN_TOKEN };
  response = await post("/admin/set-auth-required", { enabled: "false" }, adminHeaders);
  assert.equal(response.status, 400);
  await post("/admin/set-auth-required", { enabled: true }, adminHeaders);
  assert.equal((await post("/open", {})).status, 401);
  assert.equal((await post("/pulse", { password: process.env.PASSWORD })).status, 200);
  assert.equal((await post("/open", {}, { Authorization: `Bearer ${token}` })).status, 200);
  assert.equal((await request("/auth-status", { headers: { Cookie: `authToken=${token}` } }).then(r => r.json())).authenticated, true);
});
