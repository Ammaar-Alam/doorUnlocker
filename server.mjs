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

// get arduino iot cloud access token
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
      },
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Error getting access token:", error);
    throw error;
  }
}

// send command to arduino iot cloud
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

// handle door commands
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

// all the rest of the commands below are part of the API that allow me to create
// an iphone shortcut/app and use the getURL contents to send commands to the
// cloud; essentially this uses the curl command through terminal

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

// start server
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// increase timeouts to handle slow connections
server.keepAliveTimeout = 61000;
server.headersTimeout = 62000;
