import express from "express";
import axios from "axios";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

app.use(cors()); // Enable all CORS requests
app.use(express.json());

const clientId = "LrCg71iVReH2gvzTxast5jGBe1dlhpX7";
const clientSecret =
  "7KHl3gqG2joOzf5Uq5eCFAumyQj4TGxcT0QFrPuMjfJ6uMf3lO4PcJtaj1YX0Wg2";

// Token endpoint
app.post("/token", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api2.arduino.cc/iot/v1/clients/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        audience: "https://api2.arduino.cc/iot",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.response ? error.response.data : "An error occurred");
  }
});

// Command endpoint
app.put("/command", async (req, res) => {
  const { accessToken, thingId, propertyId, command } = req.body;
  try {
    const response = await axios.put(
      `https://api2.arduino.cc/iot/v2/things/${thingId}/properties/${propertyId}/publish`,
      { value: command },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.response ? error.response.data : "An error occurred");
  }
});

// Time endpoint
app.get("/current-time", async (req, res) => {
  try {
    const response = await fetch(
      "http://worldtimeapi.org/api/timezone/America/New_York",
    );
    const data = await response.json();
    res.json({ unixtime: data.unixtime });
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to fetch time");
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
