const express = require("express");
const axios = require("axios");

const app = express();

// Serve the control interface
app.use(express.static("public"));

// Endpoint to receive commands
app.get("/command", async (req, res) => {
  const command = req.query.cmd;
  console.log(`Received command: ${command}`);

  try {
    // Send the command to the Arduino
    const arduinoIP = "10.9.89.166"; // Replace with your Arduino's IP address
    const response = await axios.get(`http://${arduinoIP}/${command}`);
    res.send(
      `Command ${command} sent successfully. Arduino responded with: ${response.data}`,
    );
  } catch (error) {
    console.error(`Error sending command to Arduino: ${error}`);
    res.status(500).send("Error sending command to Arduino");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
