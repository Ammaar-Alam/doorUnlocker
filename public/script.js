// redirect to HTTPS if accessed over HTTP
// not necessary, but google crawler/url inspect is slow to update cache
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.protocol !== "https:") {
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
        document.querySelector("#doorbell-section").style.display = "block";
        // After successful login, fetch the current door status to sync UI.
        getDoorStatus();
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
        // if auth isn't required, hide login and show control panel and doorbell section
        document.querySelector("#login-section").style.display = "none";
        document.querySelector(".control-panel").style.display = "block";
        document.querySelector("#doorbell-section").style.display = "block";
        getDoorStatus();
      }
    })
    .catch((error) => console.error("Error checking auth status:", error));

  // fetch door status from server
  async function getDoorStatus() {
    try {
      const headers = { "Content-Type": "application/json" };
      if (authRequired) {
        const token = localStorage.getItem("authToken");
        if (token) {
          headers["Authorization"] = token;
        }
      }
      const response = await fetch("/status", {
        method: "GET",
        headers,
      });
      if (!response.ok) {
        console.error("Failed to get door status:", await response.text());
        return;
      }
      const data = await response.json();
      setToggle(data.doorOpen);
    } catch (error) {
      console.error("Error fetching door status:", error);
    }
  }

  // set toggle state based on doorOpen boolean
  function setToggle(isOpen) {
    const doorSwitch = document.getElementById("doorSwitch");
    doorSwitch.checked = !!isOpen;
    updateStatus();
  }

  async function sendCommand(command) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (authRequired) {
        const token = localStorage.getItem("authToken");
        if (!token) {
          console.error("No auth token found. Please log in again.");
          return;
        }
        headers["Authorization"] = token;
      }

      const response = await fetch("/command", {
        method: "POST",
        headers,
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        const errorDetail = await response.text();
        console.error("Failed to send command:", errorDetail);
        return;
      }
      console.log(await response.text());
      // Refresh door status after sending command so UI stays in sync
      getDoorStatus();
    } catch (error) {
      console.error("Error during the request:", error);
    }
  }

  function updateStatus() {
    const doorSwitch = document.getElementById("doorSwitch");
    const openStatus = document.getElementById("open");
    const closedStatus = document.getElementById("closed");

    // If switch is checked, door is considered open; otherwise closed
    if (doorSwitch.checked) {
      openStatus.style.color = "rgba(255, 94, 85, 1)"; // solid red
      closedStatus.style.color = "#888"; // default gray
    } else {
      closedStatus.style.color = "rgba(76, 175, 80, 1)"; // solid green
      openStatus.style.color = "#888"; // default gray
    }
  }

  // handle user toggling the switch
  function toggleSwitch() {
    const doorSwitch = document.getElementById("doorSwitch");
    const command = doorSwitch.checked ? "open" : "close";
    sendCommand(command);
    updateStatus();
  }

  // manual open door
  function manualOpen() {
    sendCommand("open");
  }

  // manual close door
  function manualClose() {
    sendCommand("close");
  }

  // Doorbell functionality
  function ringDoorbell() {
    const doorbellInput = document.getElementById("doorbellMessage");
    const message = doorbellInput.value || "Default doorbell ring: Someone rang your doorbell!";
    const token = localStorage.getItem("authToken");
    let headers = { "Content-Type": "application/json" };
    if (authRequired && token) {
      headers["Authorization"] = token;
    }
    fetch("/ring-doorbell", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ message: message })
    })
    .then(response => {
      if (response.ok) {
        alert("Doorbell rung successfully!");
        doorbellInput.value = "";
      } else {
        response.text().then(text => alert("Failed to ring doorbell: " + text));
      }
    })
    .catch(error => {
      console.error("Error sending doorbell request:", error);
      alert("Error sending doorbell request.");
    });
  }

  const doorSwitch = document.getElementById("doorSwitch");
  if (doorSwitch) {
    doorSwitch.addEventListener("change", toggleSwitch);
  } else {
    console.error("doorSwitch element not found");
  }

  // new manual open/close buttons
  const openButton = document.getElementById("manualOpenButton");
  const closeButton = document.getElementById("manualCloseButton");
  if (openButton) {
    openButton.onclick = manualOpen;
  }
  if (closeButton) {
    closeButton.onclick = manualClose;
  }
  
  // event listener for doorbell button
  const ringDoorbellButton = document.getElementById("ringDoorbellButton");
  if (ringDoorbellButton) {
    ringDoorbellButton.onclick = ringDoorbell;
  }
});
