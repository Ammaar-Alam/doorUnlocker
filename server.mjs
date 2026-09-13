import express from "express";
import { startArduinoStatus } from "./arduino-status.mjs";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || ".env" });

export const app = express();
const api = express.Router();
const thingId = process.env.THING_ID;
const propertyId = process.env.PROPERTY_ID;
const commandPropertyId = process.env.COMMAND_PROPERTY_ID;
const PASSWORD = process.env.PASSWORD;
const SECRET_KEY = process.env.SECRET_KEY || process.env.JWT_SECRET;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.AUTH_ADMIN_TOKEN;
const AUTH_MODE = process.env.AUTH_REQUIRED || "scheduled";
const AUTH_TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 86400);
const ARDUINO_HTTP_TIMEOUT_MS = Number(process.env.ARDUINO_HTTP_TIMEOUT_MS || 8000);
const STATUS_POLL_INTERVAL_MS = Number(process.env.STATUS_POLL_INTERVAL_MS || 5000);
const NTFY_URL = (process.env.NTFY_URL || "https://ntfy.sh").replace(/\/$/, "");
const NTFY_TOPIC = process.env.NTFY_TOPIC;
const SMS_URL = process.env.INFOBIP_BASE_URL?.replace(/\/$/, "");
const SMS_KEY = process.env.INFOBIP_API_KEY;
const SMS_FROM = process.env.INFOBIP_FROM_NUMBER;
const SMS_TO = process.env.INFOBIP_TO_NUMBER;
const smsConfigured = SMS_URL && SMS_KEY && SMS_FROM && SMS_TO;
const authSecret = SECRET_KEY || crypto.randomBytes(32).toString("hex");
const newYorkHour = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", hour: "numeric", hourCycle: "h23",
});
let authOverride = null;

export function authRequired(now = new Date()) {
  if (authOverride !== null) return authOverride;
  return AUTH_MODE === "scheduled"
    ? Number(newYorkHour.format(now)) < 8
    : AUTH_MODE !== "false";
}

app.set("trust proxy", 1);
app.use(express.static(fileURLToPath(new URL("./public", import.meta.url))));
app.use("/vendor/three", express.static(fileURLToPath(new URL("./node_modules/three/build", import.meta.url))));
for (const path of ["loaders/STLLoader.js", "controls/OrbitControls.js"]) {
  app.get(`/vendor/${path}`, (req, res) => res.sendFile(fileURLToPath(new URL(`./node_modules/three/examples/jsm/${path}`, import.meta.url))));
}
app.get("/models/spindle.stl", (req, res) => res.sendFile(fileURLToPath(new URL("./hardware/models/motor-spindle-final-optimized.stl", import.meta.url))));
app.get("/models/base.stl", (req, res) => res.sendFile(fileURLToPath(new URL("./hardware/models/base.stl", import.meta.url))));
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());
app.use(["/api", "/"], api);
api.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

function authenticated(req) {
  const header = (req.headers.authorization || "").trim();
  const token = header.replace(/^Bearer\s+/i, "") || req.cookies?.authToken;
  try {
    return jwt.verify(token, authSecret, { algorithms: ["HS256"] }).authenticated === true;
  } catch {
    return false;
  }
}

function passwordMatches(password) {
  if (!PASSWORD || typeof password !== "string") return false;
  const supplied = crypto.createHash("sha256").update(password).digest();
  const expected = crypto.createHash("sha256").update(PASSWORD).digest();
  return crypto.timingSafeEqual(supplied, expected);
}

function checkAuth(req, res, next) {
  if (!authRequired() || authenticated(req) || passwordMatches(req.body?.password)) return next();
  res.status(401).json({ ok: false, message: "Please log in to control the door" });
}

api.get("/auth-status", (req, res) => {
  res.json({ authRequired: authRequired(), authenticated: authenticated(req), preview: app.locals.preview === true });
});

api.post("/login", (req, res) => {
  if (!PASSWORD || !SECRET_KEY) {
    return res.status(503).json({ ok: false, message: "Login is not configured" });
  }
  if (!passwordMatches(req.body?.password)) {
    return res.status(401).json({ ok: false, message: "Invalid password" });
  }
  const token = jwt.sign({ authenticated: true }, authSecret, { expiresIn: AUTH_TOKEN_TTL_SECONDS });
  res.cookie("authToken", token, {
    secure: process.env.NODE_ENV === "production", httpOnly: true,
    sameSite: "lax", maxAge: AUTH_TOKEN_TTL_SECONDS * 1000,
  });
  res.json({ ok: true, message: "Login successful", token });
});

let accessToken = null;
let tokenExpiresAt = 0;
let tokenInFlight = null;
let recentArduinoRequests = [];

async function arduinoFetch(path, options = {}) {
  const startedAt = Date.now();
  const signal = options.signal || AbortSignal.timeout(ARDUINO_HTTP_TIMEOUT_MS);
  for (let attempt = 0; ; attempt++) {
    const now = Date.now();
    recentArduinoRequests = recentArduinoRequests.filter(time => now - time < 1000);
    const requestCount = recentArduinoRequests.push(now);
    const response = await fetch(`https://api2.arduino.cc/iot/${path}`, { ...options, signal });
    if (response.status === 429) console.warn(`Arduino ${options.method || "GET"} ${path}: 429; ${requestCount} server requests in preceding second; Retry-After=${response.headers.get("Retry-After")}`);
    if (response.status !== 429 || attempt === 2) return response;
    const retryAfter = response.headers.get("Retry-After");
    const requestedDelay = /^\d+$/.test(retryAfter ?? "") ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
    const delay = Number.isFinite(requestedDelay) ? Math.max(0, requestedDelay) : 1000 * (attempt + 1);
    if (delay >= ARDUINO_HTTP_TIMEOUT_MS - (Date.now() - startedAt)) return response;
    await response.body?.cancel();
    console.warn(`Arduino ${options.method || "GET"} ${path}: 429, retry ${attempt + 1}/2 in ${delay} ms`);
    await sleep(delay, undefined, { signal });
  }
}

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
  if (tokenInFlight) return tokenInFlight;
  tokenInFlight = (async () => {
    const response = await arduinoFetch("v1/clients/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials", client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET, audience: "https://api2.arduino.cc/iot",
      }),
    });
    if (!response.ok) throw new Error(`Arduino authentication failed (${response.status})`);
    const data = await response.json();
    if (!data.access_token || !(data.expires_in > 0)) throw new Error("Invalid Arduino token response");
    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + Math.max(0, data.expires_in * 1000 - 30000);
    return accessToken;
  })();
  try {
    return await tokenInFlight;
  } finally {
    tokenInFlight = null;
  }
}

async function arduinoRequest(path, options = {}, retryAuth = true) {
  options = { ...options, signal: options.signal || AbortSignal.timeout(ARDUINO_HTTP_TIMEOUT_MS) };
  const token = await getAccessToken();
  const response = await arduinoFetch(`v2/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (response.status === 401 && retryAuth) {
    await response.arrayBuffer();
    if (accessToken === token) accessToken = null;
    return arduinoRequest(path, options, false);
  }
  if (!response.ok) throw new Error(`Arduino ${options.method || "GET"} ${path} failed (${response.status})`);
  if (options.method === "PUT") {
    await response.arrayBuffer();
    return;
  }
  return response.json();
}

let latestTelemetry = null;
let telemetryReceivedAt = null;

api.get("/diagnostics", (req, res) => {
  if (!authenticated(req)) return res.status(401).json({ ok: false, message: "Please log in to view diagnostics" });
  res.json({ telemetry: latestTelemetry, receivedAt: telemetryReceivedAt });
});

let deviceId = null;
let liveDoorOpen = null;
let liveUpdatedAt = null;
let statusInFlight = null;
let cachedStatus = null;
let statusFetchedAt = 0;
async function fetchDoorStatus() {
  if (cachedStatus && Date.now() - statusFetchedAt < STATUS_POLL_INTERVAL_MS) return cachedStatus;
  if (statusInFlight) return statusInFlight;
  statusInFlight = (async () => {
    const readStartedAt = Date.now();
    if (!deviceId) {
      const thing = await arduinoRequest(`things/${thingId}`);
      if (!thing.device_id) throw new Error("Arduino Thing has no device");
      deviceId = thing.device_id;
    }
    const [property, device] = await Promise.all([
      liveDoorOpen === null ? arduinoRequest(`things/${thingId}/properties/${propertyId}`) : null,
      arduinoRequest(`devices/${deviceId}`),
    ]);
    if (cachedStatus && statusFetchedAt > readStartedAt) return cachedStatus;
    const online = device.device_status === "ONLINE";
    const value = liveDoorOpen ?? property?.last_value;
    if (typeof value !== "boolean") throw new Error("Arduino door state is unavailable");
    cachedStatus = { doorOpen: online ? value : null, online, updatedAt: liveUpdatedAt || property?.value_updated_at || null };
    statusFetchedAt = Date.now();
    return cachedStatus;
  })();
  try {
    return await statusInFlight;
  } finally {
    statusInFlight = null;
  }
}

const sseClients = new Map();
function sseSend(res, data) {
  if (!res.destroyed && !res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
}

let broadcastInFlight = false;
async function broadcastStatus() {
  if (!sseClients.size || broadcastInFlight) return;
  broadcastInFlight = true;
  let status;
  try {
    status = await fetchDoorStatus();
  } catch (error) {
    console.warn("Door status unavailable:", error.message);
    status = liveDoorOpen !== null && cachedStatus ? cachedStatus : { doorOpen: null, online: false, message: "Door status unavailable" };
  }
  sendStatusToClients(status);
  broadcastInFlight = false;
}

function sendStatusToClients(status) {
  for (const [res, req] of sseClients) {
    if (authRequired() && !authenticated(req)) {
      sseSend(res, { authRequired: true });
      res.end();
    } else {
      sseSend(res, status);
    }
  }
}

api.get("/events", checkAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 25000);
  sseClients.set(res, req);
  res.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
  void broadcastStatus();
});

api.get("/status", checkAuth, async (req, res, next) => {
  try {
    res.json(await fetchDoorStatus());
  } catch (error) {
    next(error);
  }
});

let commandInFlight = false;
async function handleDoorCommand(res, command, next) {
  if (commandInFlight) return res.status(409).json({ ok: false, message: "A door command is already being sent" });
  if (!commandPropertyId) return res.status(503).json({ ok: false, message: "Door controller update is not configured" });
  commandInFlight = true;
  try {
    const status = await fetchDoorStatus();
    if (!status.online) return res.status(503).json({ ok: false, message: "Door controller is offline" });
    await arduinoRequest(`things/${thingId}/properties/${commandPropertyId}/publish`, {
      method: "PUT", body: JSON.stringify({ value: `${command}:${Math.floor(Date.now() / 1000) + 10}:${crypto.randomUUID()}` }),
    });
    res.json({ ok: true, command, message: "Command sent" });
    void broadcastStatus();
  } catch (error) {
    console.warn(`Door command ${command} failed:`, error.message);
    next(error);
  } finally {
    commandInFlight = false;
  }
}

api.post("/command", checkAuth, (req, res, next) => {
  const command = req.body?.command;
  if (!["open", "close", "force-open", "force-close"].includes(command)) {
    return res.status(400).json({ ok: false, message: "Invalid door command" });
  }
  return handleDoorCommand(res, command, next);
});
for (const command of ["open", "close", "force-open", "force-close"]) {
  api.post(`/${command}`, checkAuth, (req, res, next) => handleDoorCommand(res, command, next));
}
api.post("/emergency-close", checkAuth, (req, res, next) => handleDoorCommand(res, "close", next));

const doorbellIpLast = new Map();
let doorbellGlobalEvents = [];
api.post("/ring-doorbell", async (req, res, next) => {
  if (!NTFY_TOPIC && !smsConfigured) return res.status(503).json({ ok: false, message: "Doorbell is not configured" });
  const now = Date.now();
  for (const [ip, time] of doorbellIpLast) {
    if (now - time >= 30000) doorbellIpLast.delete(ip);
  }
  doorbellGlobalEvents = doorbellGlobalEvents.filter(time => now - time < 600000);
  if (doorbellIpLast.has(req.ip) || doorbellGlobalEvents.length >= 10) {
    return res.status(429).json({ ok: false, message: "Please wait before ringing again" });
  }
  const message = req.body?.message;
  if (message !== undefined && typeof message !== "string") {
    return res.status(400).json({ ok: false, message: "Message must be text" });
  }
  doorbellIpLast.set(req.ip, now);
  doorbellGlobalEvents.push(now);
  try {
    const text = (message?.trim() || "Someone rang your doorbell").replace(/[\r\n]+/g, " ").slice(0, 240);
    const response = await fetch(NTFY_TOPIC ? `${NTFY_URL}/${NTFY_TOPIC}` : `${SMS_URL}/sms/2/text/advanced`, {
      method: "POST",
      headers: NTFY_TOPIC
        ? { Title: "Doorbell", Priority: "high", "Content-Type": "text/plain" }
        : { Authorization: `App ${SMS_KEY}`, "Content-Type": "application/json" },
      body: NTFY_TOPIC ? text : JSON.stringify({ messages: [{ from: SMS_FROM, destinations: [{ to: SMS_TO }], text }] }),
      signal: AbortSignal.timeout(ARDUINO_HTTP_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Doorbell delivery failed (${response.status})`);
    await response.arrayBuffer();
    res.json({ ok: true, message: "Doorbell rung" });
  } catch (error) {
    next(error);
  }
});

api.post("/admin/set-auth-required", (req, res) => {
  const supplied = (req.headers["x-admin-token"] || req.headers.authorization?.replace(/^Bearer\s+/i, "") || "").trim();
  if (!ADMIN_TOKEN || supplied !== ADMIN_TOKEN) return res.status(403).json({ ok: false, message: "Forbidden" });
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean" && enabled !== null) {
    return res.status(400).json({ ok: false, message: "Enabled must be true, false, or null" });
  }
  authOverride = enabled;
  res.json({ ok: true, authRequired: authRequired() });
  void broadcastStatus();
});

app.use((req, res) => res.status(404).json({ ok: false, message: "Endpoint not found" }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("Request failed:", error.message);
  const status = error.status === 400 || error.status === 413 ? error.status : 502;
  const message = status === 400 ? "Invalid JSON request" : status === 413 ? "Request is too large" : "Door service unavailable. Check the controller before trying again.";
  res.status(status).json({ ok: false, message });
});

export function startServer(port = process.env.PORT || 3000) {
  for (const [name, value] of Object.entries({ AUTH_TOKEN_TTL_SECONDS, ARDUINO_HTTP_TIMEOUT_MS, STATUS_POLL_INTERVAL_MS })) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  }
  if (!["true", "false", "scheduled"].includes(AUTH_MODE)) throw new Error("AUTH_REQUIRED must be true, false, or scheduled");
  const server = app.listen(port, process.env.HOST || "127.0.0.1");
  const poll = setInterval(() => void broadcastStatus(), STATUS_POLL_INTERVAL_MS);
  server.on("close", () => clearInterval(poll));
  server.keepAliveTimeout = 61000;
  server.headersTimeout = 62000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const missing = ["THING_ID", "PROPERTY_ID", "COMMAND_PROPERTY_ID", "CLIENT_ID", "CLIENT_SECRET", "PASSWORD"].filter(name => !process.env[name]);
  if (!SECRET_KEY) missing.push("SECRET_KEY");
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(", ")}`);
  const server = startServer();
  const stopLiveStatus = startArduinoStatus(thingId, getAccessToken, value => {
    console.log("Live door state:", value);
    liveDoorOpen = value;
    liveUpdatedAt = new Date().toISOString();
    cachedStatus = { doorOpen: value, online: true, updatedAt: liveUpdatedAt };
    statusFetchedAt = Date.now();
    sendStatusToClients(cachedStatus);
  }, () => {
    liveDoorOpen = null;
    liveUpdatedAt = null;
    cachedStatus = null;
  }, telemetry => {
    latestTelemetry = telemetry;
    telemetryReceivedAt = Date.now();
    if (!process.stdout.writableNeedDrain) console.log('Bluetooth RSSI:', JSON.stringify(telemetry));
  });
  server.on("listening", () => console.log(`Door server listening on port ${server.address().port}`));
  const shutdown = () => {
    stopLiveStatus();
    for (const res of sseClients.keys()) res.end();
    server.close();
    setTimeout(() => process.exit(1), 20000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
