import express from "express";
import session from "express-session";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import checkAuth from "check-auth";

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

// Stuff for creating the cookies for shortcut API and iOS apps
app.use(cookieParser());
app.use(bodyParser.json());

// Middleware to parse JSON bodies
app.use(express.json());

app.use(
  session({
    secret: SECRET_KEY,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Use true if HTTPS is enabled
  }),
);

const createToken = (password) => {
  if (password === process.env.AUTH_PASSWORD) {
    return jwt.sign({ password }, secretKey, { expiresIn: "1h" });
  }
  return null;
};

// Login route
app.post("/login", (req, res) => {
  const { password } = req.body;
  const token = createToken(password);
  if (token) {
    res.cookie("token", token, { httpOnly: true });
    res.json({ message: "Login Successful" });
  } else {
    res.status(401).json({ message: "Invalid Password" });
  }
});

const authenticate = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  });
};

// Middleware to check authentication
// function checkAuth(req, res, next) {
//   if (req.session.authenticated) {
//     return next();
//   } else {
//     res.status(403).send("Not authenticated");
//   }
// }

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
    res.status(500).send("Internal Server Error");
  }
});

app.post("/command", checkAuth, async (req, res) => {
  try {
    const { accessToken, command } = req.body;
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
      res.status(500).send("Internal Server Error");
      return;
    }

    res.send("Command sent successfully");
  } catch (error) {
    console.error("Error sending command:", error);
    res.status(500).send("Internal Server Error");
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

    res.send("Emergency close command sent successfully");
  } catch (error) {
    console.error("Error sending emergency close command:", error);
    res.status(500).send("Internal Server Error");
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

    res.send("Open command sent successfully");
  } catch (error) {
    console.error("Error sending open command:", error);
    res.status(500).send("Internal Server Error");
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

    res.send("Close command sent successfully");
  } catch (error) {
    console.error("Error sending close command:", error);
    res.status(500).send("Internal Server Error");
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
    res.json({ doorOpen: status.last_value });
  } catch (error) {
    console.error("Error fetching status:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
