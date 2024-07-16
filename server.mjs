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

// Serve static files from the "public" directory
app.use(express.static("public"));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

// Trust first proxy for Heroku
app.set("trust proxy", 1);

app.use(
  session({
    secret: SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Logging middleware to check session
app.use((req, res, next) => {
  console.log(`Session ID: ${req.sessionID}`);
  console.log(`Session: ${JSON.stringify(req.session)}`);
  next();
});

// Login route
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
          token: req.sessionID, // Send the session ID as a token
        });
      }
    });
  } else {
    res.status(401).json({ message: "Invalid password" });
  }
});

// Middleware to check authentication
function checkAuth(req, res, next) {
  const token = req.headers["authorization"];
  if (token) {
    // Find the session based on the token (which is the session ID)
    req.sessionStore.get(token, (err, session) => {
      if (err) {
        console.error("Session retrieval error:", err);
        return res.status(500).json({ message: "Internal Server Error" });
      }
      if (session && session.authenticated) {
        req.session = session;
        return next();
      } else {
        return res.status(403).json({ message: "Not authenticated" });
      }
    });
  } else {
    res.status(403).json({ message: "No token provided" });
  }
}

app.post("/token", checkAuth, async (req, res) => {
  try {
    const response = await fetch(`${proxyServerUrl}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error fetching token:", error);
    res.status(500).send("Internal Server Error").end();
  }
});

app.post("/command", checkAuth, async (req, res) => {
  try {
    const { command } = req.body;
    const tokenResponse = await fetch(`${proxyServerUrl}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!tokenResponse.ok) {
      const errorDetail = await tokenResponse.text();
      console.error("Failed to get access token:", errorDetail);
      res.status(500).send("Failed to get access token");
      return;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const response = await fetch(
      `https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}/publish`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: command === "open" }),
      },
    );

    if (!response.ok) {
      const errorDetail = await response.text();
      console.error("Failed to update property:", errorDetail);
      res.status(500).send("Failed to update property");
      return;
    }

    res.send("Command sent successfully");
  } catch (error) {
    console.error("Error sending command:", error);
    res.status(500).send("Internal Server Error").end();
  }
});

app.post("/emergency-close", checkAuth, async (req, res) => {
  try {
    const tokenResponse = await fetch(`${proxyServerUrl}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!tokenResponse.ok) {
      const errorDetail = await tokenResponse.text();
      console.error("Failed to get access token:", errorDetail);
      res.status(500).send("Failed to get access token");
      return;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const response = await fetch(
      `https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}/publish`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: false }), // Assuming false means closed
      },
    );

    if (!response.ok) {
      const errorDetail = await response.text();
      console.error("Failed to update property:", errorDetail);
      res.status(500).send("Failed to update property");
      return;
    }

    res.status(200).send("Emergency-Close Command sent successfully").end();
  } catch (error) {
    console.error("Error sending emergency close command:", error);
    res.status(500).send("Internal Server Error").end();
  }
});

app.post("/open", checkAuth, async (req, res) => {
  try {
    const tokenResponse = await fetch(`${proxyServerUrl}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!tokenResponse.ok) {
      const errorDetail = await tokenResponse.text();
      console.error("Failed to get access token:", errorDetail);
      res.status(500).send("Failed to get access token");
      return;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const response = await fetch(
      `https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}/publish`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: true }), // true means open
      },
    );

    if (!response.ok) {
      const errorDetail = await response.text();
      console.error("Failed to update property:", errorDetail);
      res.status(500).send("Failed to update property");
      return;
    }

    res.status(200).send("Open Command sent successfully").end();
  } catch (error) {
    console.error("Error sending open command:", error);
    res.status(500).send("Internal Server Error").end();
  }
});

app.post("/close", checkAuth, async (req, res) => {
  try {
    const tokenResponse = await fetch(`${proxyServerUrl}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!tokenResponse.ok) {
      const errorDetail = await tokenResponse.text();
      console.error("Failed to get access token:", errorDetail);
      res.status(500).send("Failed to get access token");
      return;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const response = await fetch(
      `https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}/publish`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: false }), // false means close
      },
    );

    if (!response.ok) {
      const errorDetail = await response.text();
      console.error("Failed to update property:", errorDetail);
      res.status(500).send("Failed to update property");
      return;
    }

    res.status(200).send("Close Command sent successfully").end();
  } catch (error) {
    console.error("Error sending close command:", error);
    res.status(500).send("Internal Server Error").end();
  }
});

app.get("/status", checkAuth, async (req, res) => {
  try {
    const tokenResponse = await fetch(`${proxyServerUrl}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!tokenResponse.ok) {
      const errorDetail = await tokenResponse.text();
      console.error("Failed to get access token:", errorDetail);
      res.status(500).send("Failed to get access token");
      return;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

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
      const errorDetail = await response.text();
      console.error("Failed to get property status:", errorDetail);
      res.status(500).send("Failed to get property status");
      return;
    }

    const status = await response.json();
    res.status(200).json({ doorOpen: status.last_value }).end();
  } catch (error) {
    console.error("Error fetching status:", error);
    res.status(500).send("Internal Server Error").end();
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// this code lets the IOS shortcut not wait 30 seconds for the server timeout
// it's a bandaid fix but idrk how to fix the server not closing the connection
server.keepAliveTimeout = 1000; // 1 second
server.headersTimeout = 1000; // 1 seconds
