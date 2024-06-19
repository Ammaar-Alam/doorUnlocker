const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());
app.use(express.static("public")); // Serve the control interface

let latestCommand = "";

app.post("/command", (req, res) => {
  latestCommand = req.body.command;
  console.log(`Received command: ${latestCommand}`);
  res.send(`Command ${latestCommand} received`);
});

app.get("/getCommand", (req, res) => {
  res.send(latestCommand);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
