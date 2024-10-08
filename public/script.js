// redirect to HTTPS if accessed over HTTP
// not necessary, but google crawler/url inspect is slow to update cache
if (window.location.protocol !== "https:") {
  window.location.href =
    "https://" + window.location.hostname + window.location.pathname + window.location.search;
}

document.addEventListener("DOMContentLoaded", function () {
  let authRequired = true; // assume auth is required by default

  async function handleLogin(event) {
    event.preventDefault();
    const password = document.getElementById("password").value;
    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("authToken", data.token);
        document.querySelector("#login-section").style.display = "none";
        document.querySelector(".control-panel").style.display = "block";
      } else {
        document.getElementById("login-error").style.display = "block";
      }
    } catch (error) {
      console.error("Error during login request:", error);
      document.getElementById("login-error").style.display = "block";
    }
  }

  document.getElementById("login-form").addEventListener("submit", handleLogin);

  // check if authentication is required
  fetch("/auth-status")
    .then((response) => response.json())
    .then((data) => {
      authRequired = data.authRequired; // store the authRequired status
      if (!authRequired) {
        // if auth isn't required, hide login and show control panel
        document.querySelector("#login-section").style.display = "none";
        document.querySelector(".control-panel").style.display = "block";
      }
    })
    .catch((error) => console.error("Error checking auth status:", error));

  async function sendCommand(command) {
    try {
      if (authRequired) {
        // if auth is required, check for token
        const token = localStorage.getItem("authToken");
        if (!token) {
          console.error("No auth token found. please log in again.");
          return;
        }
      }

      const response = await fetch("/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authRequired ? localStorage.getItem("authToken") : "", // only add token if auth is required
        },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        const errorDetail = await response.text();
        console.error("Failed to send command:", errorDetail);
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
      openStatus.style.color = "rgba(255, 94, 85, 1)"; // solid red
      closedStatus.style.color = "#888"; // default gray
    }
  }

  function toggleSwitch() {
    const doorSwitch = document.getElementById("doorSwitch");
    const command = doorSwitch.checked ? "open" : "close";
    sendCommand(command);
    updateStatus();
  }

  async function emergencyClose() {
    try {
      if (authRequired) {
        // if auth is required, check for token
        const token = localStorage.getItem("authToken");
        if (!token) {
          console.error("No auth token found. please log in again.");
          return;
        }
      }

      const response = await fetch("/emergency-close", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authRequired ? localStorage.getItem("authToken") : "", // only add token if auth is required
        },
      });

      if (!response.ok) {
        const errorDetail = await response.text();
        console.error("Failed to send emergency close command:", errorDetail);
        return;
      }

      console.log(await response.text());
    } catch (error) {
      console.error("Error during emergency close request:", error);
    }
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
