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

// Set Connection header to close
app.use((req, res, next) => {
  res.set("Connection", "close");
  next();
});

// Trust first proxy for Heroku
app.set("trust proxy", 1);

app.use(
  session({
    secret: SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
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
        res.status(500).json({ message: "Internal Server Error" }).end();
      } else {
        console.log("Login successful, session ID:", req.sessionID);
        res
          .status(200)
          .json({
            message: "Login successful",
            token: req.sessionID,
          })
          .end();
      }
    });
  } else {
    res.status(401).json({ message: "Invalid password" }).end();
  }
});

// Middleware to check authentication
function checkAuth(req, res, next) {
  const token = req.headers["authorization"];
  if (token) {
    req.sessionStore.get(token, (err, session) => {
      if (err) {
        console.error("Session retrieval error:", err);
        return res.status(500).json({ message: "Internal Server Error" }).end();
      }
      if (session && session.authenticated) {
        req.session = session;
        return next();
      } else {
        return res.status(403).json({ message: "Not authenticated" }).end();
      }
    });
  } else {
    res.status(403).json({ message: "No token provided" }).end();
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
    res.json(data).end();
  } catch (error) {
    console.error("Error fetching token:", error);
    res.status(500).send("Internal Server Error").end();
  }
});

app.post("/command", checkAuth, (req, res) => {
  const { command } = req.body;
  res.status(200).send("Command received").end();

  (async () => {
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
      }
    } catch (error) {
      console.error("Error sending command:", error);
    }
  })();
});

app.post("/emergency-close", checkAuth, (req, res) => {
  res.status(200).send("Emergency close command received").end();

  (async () => {
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
          body: JSON.stringify({ value: false }),
        },
      );

      if (!response.ok) {
        const errorDetail = await response.text();
        console.error("Failed to update property:", errorDetail);
      }
    } catch (error) {
      console.error("Error sending emergency close command:", error);
    }
  })();
});

app.post("/open", checkAuth, (req, res) => {
  res.status(200).send("Open command received").end();

  (async () => {
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
          body: JSON.stringify({ value: true }),
        },
      );

      if (!response.ok) {
        const errorDetail = await response.text();
        console.error("Failed to update property:", errorDetail);
      }
    } catch (error) {
      console.error("Error sending open command:", error);
    }
  })();
});

app.post("/close", checkAuth, (req, res) => {
  res.status(200).send("Close command received").end();

  (async () => {
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
          body: JSON.stringify({ value: false }),
        },
      );

      if (!response.ok) {
        const errorDetail = await response.text();
        console.error("Failed to update property:", errorDetail);
      }
    } catch (error) {
      console.error("Error sending close command:", error);
    }
  })();
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
      res.status(500).send("Failed to get access token").end();
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
      res.status(500).send("Failed to get property status").end();
      return;
    }

    const status = await response.json();
    res.status(200).json({ doorOpen: status.last_value }).end();
  } catch (error) {
    console.error("Error fetching status:", error);
    res.status(500).send("Internal Server Error").end();
  }
});

const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

server.keepAliveTimeout = 1000; // 1 second
server.headersTimeout = 1500; // 1.5 seconds
