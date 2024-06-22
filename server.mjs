import express from "express";
import fetch from "node-fetch";

const app = express();
const port = process.env.PORT || 3000;

const thingId = "3420f1e7-f743-4d7d-91df-ea746d4f01e0";
const propertyId = "05522adb-784b-4edf-8855-2baf1e132187";
const proxyServerUrl = "https://proxy-server-alam-ec4f553c366a.herokuapp.com";

// Serve static files from the "public" directory
app.use(express.static("public"));

// Middleware to parse JSON bodies
app.use(express.json());

app.post("/token", async (req, res) => {
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

app.post("/command", async (req, res) => {
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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
