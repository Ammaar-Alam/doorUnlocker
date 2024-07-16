import express from "express";
import session from "express-session";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const thingId = process.env.THING_ID;
const propertyId = process.env.PROPERTY_ID;
const proxyServerUrl = process.env.PROXY_SERVER_URL;
const PASSWORD = process.env.PASSWORD;
const SECRET_KEY = process.env.SECRET_KEY;

app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());

app.set("trust proxy", 1);

const sessionMiddleware = session({
  secret: SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  },
});

app.use(sessionMiddleware);

app.use((req, res, next) => {
  console.log(`Session ID: ${req.sessionID}`);
  console.log(`Session: ${JSON.stringify(req.session)}`);
  next();
});

app.post("/login", (req, res) => {
  const { password } = req.body;
  if (password === PASSWORD) {
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

function checkAuth(req, res, next) {
  const token = req.headers["authorization"];
  if (token) {
    req.sessionStore.get(token, (err, sessionData) => {
      if (err) {
        console.error("Session retrieval error:", err);
        return res.status(500).json({ message: "Internal Server Error" });
      }
      if (sessionData && sessionData.authenticated) {
        // Reconstruct the session
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

async function getAccessToken() {
  const response = await fetch(`${proxyServerUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error("Failed to get access token");
  }
  const data = await response.json();
  return data.access_token;
}

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
    },
  );
  if (!response.ok) {
    throw new Error("Failed to update property");
  }
}

app.post("/command", checkAuth, async (req, res) => {
  const { command } = req.body;
  try {
    await sendCommand(command === "open");
    res.status(200).send("Command sent successfully");
  } catch (error) {
    console.error("Error sending command:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/emergency-close", checkAuth, async (req, res) => {
  try {
    await sendCommand(false);
    res.status(200).send("Emergency close command sent successfully");
  } catch (error) {
    console.error("Error sending emergency close command:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/open", checkAuth, async (req, res) => {
  try {
    await sendCommand(true);
    res.status(200).send("Open command sent successfully");
  } catch (error) {
    console.error("Error sending open command:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/close", checkAuth, async (req, res) => {
  try {
    await sendCommand(false);
    res.status(200).send("Close command sent successfully");
  } catch (error) {
    console.error("Error sending close command:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/status", checkAuth, async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const response = await fetch(
      `https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!response.ok) {
      throw new Error("Failed to get property status");
    }
    const status = await response.json();
    res.status(200).json({ doorOpen: status.last_value });
  } catch (error) {
    console.error("Error fetching status:", error);
    res.status(500).send("Internal Server Error");
  }
});

const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

server.keepAliveTimeout = 61000;
server.headersTimeout = 62000;
