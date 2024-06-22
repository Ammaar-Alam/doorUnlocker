document.addEventListener("DOMContentLoaded", function () {
  async function sendCommand(command) {
    try {
      const tokenResponse = await fetch("/token", {
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

      const response = await fetch("/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken,
          command,
        }),
      });

      if (!response.ok) {
        const errorDetail = await response.text();
        console.error("Failed to update property:", errorDetail);
        return;
      }

      console.log(await response.text());
    } catch (error) {
      console.error("Error during the request:", error);
    }
  }

  function toggleSwitch() {
    const doorSwitch = document.getElementById("doorSwitch");
    const command = doorSwitch.checked ? "open" : "close";
    sendCommand(command);
  }

  const doorSwitch = document.getElementById("doorSwitch");
  if (doorSwitch) {
    doorSwitch.onclick = toggleSwitch;
  } else {
    console.error("doorSwitch element not found");
  }
});
