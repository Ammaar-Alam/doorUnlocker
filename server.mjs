import express from "express";
import session from "express-session";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import axios from "axios";

// load env vars
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// get env vars
const thingId = process.env.THING_ID;
const propertyId = process.env.PROPERTY_ID;
const PASSWORD = process.env.PASSWORD;
const SECRET_KEY = process.env.SECRET_KEY;
const AUTH_REQUIRED = process.env.AUTH_REQUIRED === "true";
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const INFOBIP_API_KEY = process.env.INFOBIP_API_KEY;
const INFOBIP_FROM_NUMBER = process.env.INFOBIP_FROM_NUMBER;
const INFOBIP_TO_NUMBER = process.env.INFOBIP_TO_NUMBER;

// set up middleware
app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());

// trust first proxy 
app.set("trust proxy", 1);

// session middleware config
const sessionMiddleware = session({
  secret: SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});

app.use(sessionMiddleware);

// log session info for debugging
app.use((req, res, next) => {
  console.log(`Session ID: ${req.sessionID}`);
  console.log(`Session: ${JSON.stringify(req.session)}`);
  next();
});

console.log("AUTH_REQUIRED:", AUTH_REQUIRED);

// --- Real-time status broadcasting (SSE) ---
const sseClients = new Set();
let currentDoorOpen = null; // cache of last known door state

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

async function fetchLatestDoorStatus() {
  const accessToken = await getAccessToken();
  const response = await fetch(
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
    throw new Error("Failed to get property status");
  }
  const status = await response.json();
  return !!status.last_value;
}

// SSE endpoint
app.get("/events", async (req, res) => {
  if (AUTH_REQUIRED && !req.session?.authenticated) {
    return res.status(403).end();
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
  res.json({ authRequired: AUTH_REQUIRED });
});

// login route
app.post("/login", (req, res) => {
  const { password } = req.body;
  if (!AUTH_REQUIRED || password === PASSWORD) {
    req.session.authenticated = true;
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        res.status(500).json({ message: "Internal Server Error" });
      } else {
        console.log("Login successful, session ID:", req.sessionID);
        res.status(200).json({
          message: "Login successful",
          token: req.sessionID,
        });
      }
    });
  } else {
    res.status(401).json({ message: "Invalid password" });
  }
});

// auth middleware
function checkAuth(req, res, next) {
  if (!AUTH_REQUIRED) {
    return next();
  }

  const token = req.headers["authorization"];
  if (token) {
    req.sessionStore.get(token, (err, sessionData) => {
      if (err) {
        console.error("Session retrieval error:", err);
        return res.status(500).json({ message: "Internal Server Error" });
      }
      if (sessionData && sessionData.authenticated) {
        req.session.authenticated = sessionData.authenticated;
        req.sessionID = token;
        return next();
      } else {
        return res.status(403).json({ message: "Not authenticated" });
      }
    });
  } else {
    res.status(403).json({ message: "No token provided" });
  }
}

// get Arduino IoT Cloud access token
async function getAccessToken() {
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
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Error getting access token:", error);
    throw error;
  }
}

// send command to Arduino IoT Cloud
async function sendCommand(value) {
  const accessToken = await getAccessToken();
  const response = await fetch(
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
    throw new Error("Failed to update property");
  }
}

// handle door commands
app.post("/command", checkAuth, async (req, res) => {
  const { command } = req.body;
  try {
    await sendCommand(command === "open");
    // Optimistically update and broadcast to connected clients
    currentDoorOpen = command === "open";
    broadcastStatus(currentDoorOpen);

    // Verify against Arduino Cloud shortly after to avoid stale UI
    setTimeout(async () => {
      try {
        const confirmed = await fetchLatestDoorStatus();
        if (confirmed !== currentDoorOpen) {
          currentDoorOpen = confirmed;
          broadcastStatus(currentDoorOpen);
        }
      } catch (e) {
        console.warn("Post-command verification failed:", e.message);
      }
    }, 1000);
    res.status(200).send("Command sent successfully");
  } catch (error) {
    console.error("Error sending command:", error);
    res.status(500).send("Internal Server Error");
  }
});

// emergency close route
app.post("/emergency-close", checkAuth, async (req, res) => {
  try {
    await sendCommand(false);
    res.status(200).send("Emergency close command sent successfully");
  } catch (error) {
    console.error("Error sending emergency close command:", error);
    res.status(500).send("Internal Server Error");
  }
});

// open door route
app.post("/open", checkAuth, async (req, res) => {
  try {
    await sendCommand(true);
    res.status(200).send("Open command sent successfully");
  } catch (error) {
    console.error("Error sending open command:", error);
    res.status(500).send("Internal Server Error");
  }
});

// close door route
app.post("/close", checkAuth, async (req, res) => {
  try {
    await sendCommand(false);
    res.status(200).send("Close command sent successfully");
  } catch (error) {
    console.error("Error sending close command:", error);
    res.status(500).send("Internal Server Error");
  }
});

// get door status
app.get("/status", checkAuth, async (req, res) => {
  try {
    const latest = await fetchLatestDoorStatus();
    currentDoorOpen = latest;
    res.status(200).json({ doorOpen: latest });
  } catch (error) {
    console.error("Error fetching status:", error);
    res.status(500).send("Internal Server Error");
  }
});

// --- Updated Doorbell Endpoint using Infobip ---
// This endpoint is available even when authentication is required.
app.post("/ring-doorbell", async (req, res) => {
  const { message } = req.body;
  const smsMessage =
    message && message.trim() !== ""
      ? message.trim()
      : "Default doorbell ring: Someone rang your doorbell!";
  console.log("Sending SMS with message:", smsMessage);
  try {
    const infobipResponse = await axios.post(
      "https://ypj15p.api.infobip.com/sms/2/text/advanced",
      {
        messages: [
          {
            destinations: [{ to: INFOBIP_TO_NUMBER }],
            from: INFOBIP_FROM_NUMBER,
            text: smsMessage,
          },
        ],
      },
      {
        headers: {
          "Authorization": `App ${INFOBIP_API_KEY}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );
    console.log("Infobip response:", infobipResponse.data);
    res.status(200).send("Doorbell rung successfully");
  } catch (error) {
    console.error(
      "Error sending doorbell SMS via Infobip:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send("Internal Server Error");
  }
});

// start server
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// increase timeouts to handle slow connections
server.keepAliveTimeout = 61000;
server.headersTimeout = 62000;

// Periodically poll Arduino Cloud to capture out-of-band changes
setInterval(async () => {
  try {
    const latest = await fetchLatestDoorStatus();
    if (currentDoorOpen === null || latest !== currentDoorOpen) {
      currentDoorOpen = latest;
      broadcastStatus(currentDoorOpen);
    }
  } catch (e) {
    console.warn("Background status poll failed:", e.message);
  }
}, 5000);
