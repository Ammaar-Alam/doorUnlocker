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

  function updateStatus() {
    const doorSwitch = document.getElementById("doorSwitch");
    const openStatus = document.getElementById("open");
    const closedStatus = document.getElementById("closed");

    if (!doorSwitch.checked) {
      closedStatus.style.color = "rgba(76, 175, 80, 1)"; // solid green
      openStatus.style.color = "#888"; // default gray
    } else {
      openStatus.style.color = "rgba(255, 94, 85, 1)"; // Solid Red
      closedStatus.style.color = "#888"; // Default gray
    }
  }

  function toggleSwitch() {
    const doorSwitch = document.getElementById("doorSwitch");
    const command = doorSwitch.checked ? "open" : "close";
    sendCommand(command);
    updateStatus();
  }

  function emergencyClose() {
    sendCommand("close");
  }

  const doorSwitch = document.getElementById("doorSwitch");
  if (doorSwitch) {
    doorSwitch.onclick = toggleSwitch;
    updateStatus(); // initialize the status on page load
  } else {
    console.error("doorSwitch element not found");
  }

  const emergencyCloseButton = document.getElementById("emergencyCloseButton");
  if (emergencyCloseButton) {
    emergencyCloseButton.onclick = emergencyClose;
  } else {
    console.error("emergencyCloseButton element not found");
  }
});
