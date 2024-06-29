import express from "express";
import fetch from "node-fetch";

const app = express();
const port = process.env.PORT || 3000;

const thingId = "3701b014-1907-43d6-b82f-c91b47d74595";
const propertyId = "3522883b-1bb8-45dc-8a58-e7d58f46308e";
const proxyServerUrl = "https://proxy-server-alam-ec4f553c366a.herokuapp.com";

// server static files from the "public" directory
app.use(express.static("public"));

// middleware to parse JSON bodies
app.use(express.json());

async function getAccessToken() {
  try {
    const response = await fetch(`${proxyServerUrl}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error("Failed to get access token");
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error fetching token:", error);
    throw new Error("Error fetching token");
  }
}

async function toggleDoorState(accessToken, state) {
  try {
    const response = await fetch(
      `https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}/publish`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: state }),
      },
    );

    if (!response.ok) {
      const errorDetail = await response.text();
      console.error("Failed to update property:", errorDetail);
      throw new Error("Failed to update property");
    }
  } catch (error) {
    console.error("Error sending command:", error);
    throw new Error("Error sending command");
  }
}

app.post("/token", async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    res.json({ access_token: accessToken });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

app.post("/command", async (req, res) => {
  try {
    const { accessToken, command } = req.body;
    await toggleDoorState(accessToken, command === "open");
    res.send("Command sent successfully");
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

// emergency close endpoint
app.post("/emergency-close", async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    await toggleDoorState(accessToken, false); // Assuming false means closed
    res.send("Emergency close command sent successfully");
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

// open command endpoint for shortcut api
app.post("/open", async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    await toggleDoorState(accessToken, true); // true means open
    res.send("Open command sent successfully");
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

// close command endpoint for shortcut api
app.post("/close", async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    await toggleDoorState(accessToken, false); // false means close
    res.send("Close command sent successfully");
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

// door status endpoint for shortcut api
app.get("/status", async (req, res) => {
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
      const errorDetail = await response.text();
      console.error("Failed to get property status:", errorDetail);
      res.status(500).send("Failed to get property status");
      return;
    }

    const status = await response.json();
    res.json({ doorOpen: status.last_value });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

// periodic toggle function
function startPeriodicToggle() {
  setInterval(async () => {
    try {
      const accessToken = await getAccessToken();
      await toggleDoorState(accessToken, true);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Delay between toggles
      await toggleDoorState(accessToken, false);
    } catch (error) {
      console.error("Error in periodic toggle:", error);
    }
  }, 1800000); // toggle every 1/2 hour (3600000 milliseconds)
}

startPeriodicToggle();

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
