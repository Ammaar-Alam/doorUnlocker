const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(express.static("public")); // Serve the control interface

let latestCommand = "";

app.post("/command", async (req, res) => {
  latestCommand = req.body.command;
  console.log(`Received command: ${latestCommand}`);

  try {
    const proxyServerUrl = process.env.PROXY_SERVER_URL;

    // Dynamically import node-fetch
    const fetch = (await import("node-fetch")).default;

    // Get the access token
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
      return res.status(500).send("Failed to get access token");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Send the command
    const response = await fetch(`${proxyServerUrl}/command`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken,
        thingId: "3420f1e7-f743-4d7d-91df-ea746d4f01e0",
        propertyId: "05522adb-784b-4edf-8855-2baf1e132187",
        command: latestCommand,
      }),
    });

    if (!response.ok) {
      const errorDetail = await response.text();
      console.error("Failed to update property:", errorDetail);
      return res.status(500).send("Failed to update property");
    }

    console.log(await response.text());
    res.send(`Command ${latestCommand} sent`);
  } catch (error) {
    console.error("Error during the request:", error);
    res.status(500).send("Error during the request");
  }
});

app.get("/getCommand", (req, res) => {
  res.send(latestCommand);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
