import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import axios from "axios";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

// load env vars
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// get env vars
const thingId = process.env.THING_ID;
const propertyId = process.env.PROPERTY_ID;
const PASSWORD = process.env.PASSWORD;
const SECRET_KEY = process.env.SECRET_KEY || process.env.JWT_SECRET;
const AUTH_TOKEN_TTL_SECONDS = Number.parseInt(process.env.AUTH_TOKEN_TTL_SECONDS || "86400", 10);
const ARDUINO_HTTP_TIMEOUT_MS = Number.parseInt(process.env.ARDUINO_HTTP_TIMEOUT_MS || "10000", 10);
const STATUS_POLL_INTERVAL_MS = Number.parseInt(process.env.STATUS_POLL_INTERVAL_MS || "5000", 10);
const COMMAND_SETTLE_MS = Number.parseInt(process.env.COMMAND_SETTLE_MS || "6000", 10);
// Mutable auth flag: defaults from env but can be toggled at runtime via admin endpoint
let authRequired = process.env.AUTH_REQUIRED === "true";
// secret required to toggle auth via admin endpoint
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.AUTH_ADMIN_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
// ntfy configuration (used for doorbell notifications)
const NTFY_URL = (process.env.NTFY_URL || "https://ntfy.sh").replace(/\/$/, "");
const NTFY_TOPIC = process.env.NTFY_TOPIC;
const authSecret = SECRET_KEY || crypto.randomBytes(32).toString("hex");
if (!SECRET_KEY) {
  console.warn("SECRET_KEY/JWT_SECRET is not set. Using ephemeral auth secret for this dyno.");
}

// set up middleware
app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());

// trust first proxy 
app.set("trust proxy", 1);

console.log("AUTH_REQUIRED:", authRequired);
console.log("Admin toggle enabled:", ADMIN_TOKEN ? "yes" : "no");

function extractAuthToken(req) {
  const header = (req.headers["authorization"] || "").toString().trim();
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  if (header) {
    return header;
  }
  return (req.cookies?.authToken || "").toString().trim();
}

function verifyAuthToken(token) {
  if (!token) {
    return null;
  }
  try {
    return jwt.verify(token, authSecret);
  } catch {
    return null;
  }
}

// --- Real-time status broadcasting (SSE) ---
const sseClients = new Set();
let currentDoorOpen = null; // cache of last known door state
let suppressContradictUntil = 0; // time until which contradictory updates are ignored

function sseSend(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastStatus(doorOpen) {
  for (const res of sseClients) {
    try {
      sseSend(res, { doorOpen });
    } catch (e) {
      // ignore broken connections; they'll be cleaned up on 'close'
    }
  }
}

function hasSuppressedDoorState() {
  return currentDoorOpen !== null && Date.now() < suppressContradictUntil;
}

async function getVisibleDoorStatus() {
  if (hasSuppressedDoorState()) {
    return currentDoorOpen;
  }
  const latest = await fetchLatestDoorStatus();
  currentDoorOpen = latest;
  return latest;
}

function applyOptimisticDoorState(doorOpen) {
  currentDoorOpen = !!doorOpen;
  suppressContradictUntil = Date.now() + COMMAND_SETTLE_MS;
  broadcastStatus(currentDoorOpen);
}

function scheduleDoorStateVerification(expectedDoorOpen) {
  setTimeout(async () => {
    try {
      const first = await fetchLatestDoorStatus();
      if (first === expectedDoorOpen) {
        currentDoorOpen = first;
        suppressContradictUntil = 0;
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 2500));
      const second = await fetchLatestDoorStatus();
      currentDoorOpen = second;
      suppressContradictUntil = 0;

      if (second !== expectedDoorOpen) {
        broadcastStatus(currentDoorOpen);
      }
    } catch (e) {
      console.warn("Post-command verification failed:", e.message);
    }
  }, 2000);
}

let cachedAccessToken = null;
let cachedAccessTokenExpiry = 0;
let accessTokenInFlight = null;

async function fetchWithTimeout(url, options = {}, timeoutMs = ARDUINO_HTTP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLatestDoorStatus() {
  const accessToken = await getAccessToken();
  const response = await fetchWithTimeout(
    `https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to get property status: ${response.status}`);
  }
  const status = await response.json();
  return !!status.last_value;
}

// SSE endpoint
app.get("/events", async (req, res) => {
  if (authRequired) {
    const payload = verifyAuthToken(extractAuthToken(req));
    if (!payload?.authenticated) {
      return res.status(403).end();
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Keep connection alive with comments
  const keepAlive = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 25000);

  // Register client
  sseClients.add(res);

  // Send initial status
  try {
    if (currentDoorOpen === null) {
      currentDoorOpen = await fetchLatestDoorStatus();
    }
    sseSend(res, { doorOpen: currentDoorOpen });
  } catch (e) {
    // best-effort: don't terminate stream; client will rely on fallback
    console.error("Initial SSE status fetch failed:", e.message);
  }

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
    try { res.end(); } catch {}
  });
});

// check if auth is required
app.get("/auth-status", (req, res) => {
  res.json({ authRequired });
});

// login route
app.post("/login", (req, res) => {
  const { password } = req.body;
  if (!authRequired || password === PASSWORD) {
    const token = jwt.sign(
      { authenticated: true },
      authSecret,
      { expiresIn: AUTH_TOKEN_TTL_SECONDS }
    );
    res.cookie("authToken", token, {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: AUTH_TOKEN_TTL_SECONDS * 1000,
    });
    res.status(200).json({
      message: "Login successful",
      token,
    });
  } else {
    res.status(401).json({ message: "Invalid password" });
  }
});

// auth middleware
function checkAuth(req, res, next) {
  if (!authRequired) {
    return next();
  }

  const token = extractAuthToken(req);
  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }
  const payload = verifyAuthToken(token);
  if (!payload?.authenticated) {
    return res.status(403).json({ message: "Not authenticated" });
  }
  req.auth = payload;
  next();
}

// get Arduino IoT Cloud access token
async function getAccessToken() {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiry) {
    return cachedAccessToken;
  }

  if (accessTokenInFlight) {
    return accessTokenInFlight;
  }

  accessTokenInFlight = (async () => {
    try {
      const response = await axios.post(
        "https://api2.arduino.cc/iot/v1/clients/token",
        new URLSearchParams({
          grant_type: "client_credentials",
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          audience: "https://api2.arduino.cc/iot",
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: ARDUINO_HTTP_TIMEOUT_MS,
        }
      );
      const token = response.data?.access_token;
      if (!token) {
        throw new Error("Arduino token response missing access_token");
      }
      const expiresInSeconds = Number(response.data?.expires_in);
      const ttlMs = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
        ? expiresInSeconds * 1000
        : 3600 * 1000;
      cachedAccessToken = token;
      cachedAccessTokenExpiry = Date.now() + Math.max(5000, ttlMs - 30000);
      return cachedAccessToken;
    } catch (error) {
      console.error("Error getting access token:", error.message || error);
      throw error;
    } finally {
      accessTokenInFlight = null;
    }
  })();

  return accessTokenInFlight;
}

// send command to Arduino IoT Cloud
async function sendCommand(value) {
  const accessToken = await getAccessToken();
  const response = await fetchWithTimeout(
    `https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}/publish`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to update property: ${response.status}`);
  }
}

async function handleDoorCommandRequest(res, nextDoorOpen, successMessage) {
  try {
    await sendCommand(nextDoorOpen);
    applyOptimisticDoorState(nextDoorOpen);
    scheduleDoorStateVerification(nextDoorOpen);
    res.status(200).send(successMessage);
  } catch (error) {
    console.error("Error sending command:", error);
    res.status(500).send("Internal Server Error");
  }
}

// handle door commands
app.post("/command", checkAuth, async (req, res) => {
  const { command } = req.body;
  if (command !== "open" && command !== "close") {
    return res.status(400).json({ message: "Command must be 'open' or 'close'" });
  }
  return handleDoorCommandRequest(
    res,
    command === "open",
    "Command sent successfully"
  );
});

// emergency close route
app.post("/emergency-close", checkAuth, async (req, res) => {
  return handleDoorCommandRequest(res, false, "Emergency close command sent successfully");
});

// open door route
app.post("/open", checkAuth, async (req, res) => {
  return handleDoorCommandRequest(res, true, "Open command sent successfully");
});

// close door route
app.post("/close", checkAuth, async (req, res) => {
  return handleDoorCommandRequest(res, false, "Close command sent successfully");
});

// get door status
app.get("/status", checkAuth, async (req, res) => {
  try {
    const doorOpen = await getVisibleDoorStatus();
    res.status(200).json({ doorOpen });
  } catch (error) {
    console.error("Error fetching status:", error);
    res.status(500).send("Internal Server Error");
  }
});

// --- Doorbell Endpoint using ntfy (with validation and rate limiting) ---
// This endpoint is available even when authentication is required.
const doorbellIpLast = new Map();
let doorbellGlobalEvents = [];

app.post("/ring-doorbell", async (req, res) => {
  // Validate configuration
  if (!NTFY_TOPIC) {
    return res.status(503).json({
      ok: false,
      error: "Doorbell not configured",
      detail: "Missing NTFY_TOPIC env var (and optional NTFY_URL)",
    });
  }

  // Rate limit: 1 per 30s per IP and max 10 per 10 minutes globally
  const now = Date.now();
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const last = doorbellIpLast.get(ip) || 0;
  if (now - last < 30_000) {
    return res.status(429).json({ ok: false, error: "Too many requests. Please wait a moment." });
  }
  // prune global window
  doorbellGlobalEvents = doorbellGlobalEvents.filter((t) => now - t < 10 * 60_000);
  if (doorbellGlobalEvents.length >= 10) {
    return res.status(429).json({ ok: false, error: "Doorbell rate limited globally. Try again soon." });
  }

  // Sanitize message
  const raw = (req.body?.message ?? "").toString();
  let bellMessage = raw.trim();
  if (!bellMessage) {
    bellMessage = "Default doorbell ring: Someone rang your doorbell!";
  }
  bellMessage = bellMessage.replace(/[\r\n]+/g, " ").slice(0, 500);

  console.log(`Sending doorbell notification via ntfy: ip=${ip}, len=${bellMessage.length}`);
  try {
    const url = `${NTFY_URL}/${NTFY_TOPIC}`;
    const ntfyResponse = await axios.post(
      url,
      bellMessage,
      {
        headers: {
          // Mirroring princeton-course-notifier: Title/Priority headers
          Title: "Doorbell",
          Priority: "high",
          "Content-Type": "text/plain",
        },
        timeout: 10_000,
      }
    );
    // update rate-limit trackers only on success
    doorbellIpLast.set(ip, now);
    doorbellGlobalEvents.push(now);

    console.log("ntfy response summary:", {
      status: ntfyResponse.status,
    });
    return res.status(200).json({ ok: true, message: "Doorbell rung successfully" });
  } catch (error) {
    const status = error.response?.status || 500;
    const detail = error.response?.data || error.message;
    console.error("Error sending doorbell notification via ntfy:", status, detail);
    return res.status(502).json({ ok: false, error: "Failed to send notification", detail });
  }
});

// --- Admin endpoint to toggle authRequired at runtime ---
app.post("/admin/set-auth-required", (req, res) => {
  const headerAuth = (req.headers["authorization"] || "").toString();
  const bearer = headerAuth.startsWith("Bearer ") ? headerAuth.slice(7) : "";
  const provided = (req.headers["x-admin-token"] || bearer || "").toString().trim();
  const expected = (ADMIN_TOKEN || "").toString().trim();
  if (!expected || provided !== expected) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  const enabled = req.body && typeof req.body.enabled !== "undefined" ? !!req.body.enabled : true;
  authRequired = enabled;
  console.log("Auth required set to:", authRequired);
  res.json({ ok: true, authRequired });
});

// start server
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// increase timeouts to handle slow connections
server.keepAliveTimeout = 61000;
server.headersTimeout = 62000;

// Periodically poll Arduino Cloud to capture out-of-band changes
let statusPollInFlight = false;
setInterval(async () => {
  if (statusPollInFlight) {
    return;
  }
  statusPollInFlight = true;
  try {
    const latest = await fetchLatestDoorStatus();
    if (currentDoorOpen === null) {
      currentDoorOpen = latest;
      broadcastStatus(currentDoorOpen);
      return;
    }
    if (latest !== currentDoorOpen) {
      // Suppress brief contradictory updates during propagation window
      if (Date.now() < suppressContradictUntil) {
        return;
      }
      currentDoorOpen = latest;
      broadcastStatus(currentDoorOpen);
    }
  } catch (e) {
    console.warn("Background status poll failed:", e.message);
  } finally {
    statusPollInFlight = false;
  }
}, STATUS_POLL_INTERVAL_MS);
