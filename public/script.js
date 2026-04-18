// redirect to HTTPS if accessed over HTTP
// not necessary, but google crawler/url inspect is slow to update cache
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.protocol !== "https:") {
  window.location.href =
    "https://" + window.location.hostname + window.location.pathname + window.location.search;
}

document.addEventListener("DOMContentLoaded", function () {
  let authRequired = true; // assume auth is required by default
  let sse;
  let statusPollTimer = null;
  let controlsLocked = false;
  let controlsBusy = false;
  let pendingDoorOpen = null;
  let pendingDoorExpiresAt = 0;
  let pendingDoorTimer = null;
  let lastConfirmedDoorOpen = null;
  let lastCommandId = 0;
  let lastStatusRequestId = 0;
  const PENDING_DOOR_WINDOW_MS = 7000;

  function syncControlsEnabled() {
    const enabled = !controlsLocked && !controlsBusy;
    const doorSwitch = document.getElementById("doorSwitch");
    const openBtn = document.getElementById("manualOpenButton");
    const closeBtn = document.getElementById("manualCloseButton");
    [doorSwitch, openBtn, closeBtn].forEach(el => {
      if (!el) return;
      el.disabled = !enabled;
      if (!enabled) {
        el.setAttribute('aria-disabled', 'true');
        el.tabIndex = -1;
      } else {
        el.removeAttribute('aria-disabled');
        el.tabIndex = 0;
      }
    });
  }

  function updateLockUI(locked) {
    controlsLocked = !!locked;
    const panel = document.querySelector('.control-panel');
    const overlay = document.getElementById('controls-overlay');
    if (panel) panel.classList.toggle('locked', controlsLocked);
    if (overlay) overlay.style.display = controlsLocked ? 'flex' : 'none';
    syncControlsEnabled();
  }

  function setControlsBusy(busy) {
    controlsBusy = !!busy;
    syncControlsEnabled();
  }

  function ensureStatusPolling() {
    if (statusPollTimer) {
      return;
    }
    statusPollTimer = setInterval(getDoorStatus, 4000);
  }

  function stopStatusPolling() {
    if (!statusPollTimer) {
      return;
    }
    clearInterval(statusPollTimer);
    statusPollTimer = null;
  }

  function clearPendingDoorState() {
    if (pendingDoorTimer) {
      clearTimeout(pendingDoorTimer);
      pendingDoorTimer = null;
    }
    pendingDoorOpen = null;
    pendingDoorExpiresAt = 0;
    setControlsBusy(false);
  }

  function hasPendingDoorState() {
    if (pendingDoorOpen === null) {
      return false;
    }
    if (Date.now() >= pendingDoorExpiresAt) {
      clearPendingDoorState();
      return false;
    }
    return true;
  }

  function beginPendingDoorState(nextDoorOpen) {
    if (pendingDoorTimer) {
      clearTimeout(pendingDoorTimer);
    }
    pendingDoorOpen = !!nextDoorOpen;
    pendingDoorExpiresAt = Date.now() + PENDING_DOOR_WINDOW_MS;
    setControlsBusy(true);
    pendingDoorTimer = window.setTimeout(() => {
      clearPendingDoorState();
      getDoorStatus();
    }, PENDING_DOOR_WINDOW_MS);
  }

  function applyDoorState(isOpen, source = "server") {
    const nextDoorOpen = !!isOpen;

    if (source === "local") {
      setToggle(nextDoorOpen);
      return;
    }

    if (hasPendingDoorState()) {
      if (nextDoorOpen === pendingDoorOpen) {
        lastConfirmedDoorOpen = nextDoorOpen;
        clearPendingDoorState();
        setToggle(nextDoorOpen);
        return;
      }

      if (source !== "local") {
        console.warn(`Ignoring stale ${source} door state`, {
          pendingDoorOpen,
          receivedDoorOpen: nextDoorOpen,
        });
        return;
      }
    }

    lastConfirmedDoorOpen = nextDoorOpen;
    setToggle(nextDoorOpen);
  }

  function revertPendingDoorState() {
    clearPendingDoorState();
    if (lastConfirmedDoorOpen === null) {
      getDoorStatus();
      return;
    }
    setToggle(lastConfirmedDoorOpen);
  }

  function startEventStream() {
    try {
      if (sse) {
        sse.close();
      }
      sse = new EventSource("/events");
      sse.onopen = () => {
        stopStatusPolling();
      };
      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (typeof data.doorOpen === "boolean") {
            applyDoorState(data.doorOpen, "sse");
          }
        } catch (e) {
          console.warn("Bad SSE payload:", e);
        }
      };
      sse.onerror = () => {
        ensureStatusPolling();
        console.warn("SSE connection error; will retry automatically.");
      };
    } catch (e) {
      console.warn("SSE unsupported or failed; falling back to polling.");
      ensureStatusPolling();
    }
  }

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
        document.querySelector("#doorbell-section").style.display = "block";
        updateLockUI(false);
        startEventStream();
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

  // mobile nav toggle
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (navToggle && navLinks) {
    const setExpanded = () => navToggle.setAttribute('aria-expanded', navLinks.classList.contains('open') ? 'true' : 'false');
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      setExpanded();
    });
    // close nav on outside click
    document.addEventListener('click', (e) => {
      if (!navLinks.contains(e.target) && !navToggle.contains(e.target)) {
        navLinks.classList.remove('open');
        setExpanded();
      }
    });
    setExpanded();
  }

  // check if authentication is required
  fetch("/auth-status")
    .then((response) => response.json())
    .then((data) => {
      authRequired = data.authRequired; // store the authRequired status
      if (!authRequired) {
        // if auth isn't required, hide login and enable controls
        document.querySelector("#login-section").style.display = "none";
        document.querySelector("#doorbell-section").style.display = "block";
        updateLockUI(false);
        startEventStream();
        getDoorStatus();
      } else {
        // auth required: keep panel visible but locked
        updateLockUI(true);
        document.querySelector("#doorbell-section").style.display = "block";
      }
    })
    .catch((error) => console.error("Error checking auth status:", error));

  // fetch door status from server
  async function getDoorStatus() {
    const requestId = ++lastStatusRequestId;
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
      if (requestId !== lastStatusRequestId) {
        return;
      }
      applyDoorState(data.doorOpen, "status");
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
    const commandId = ++lastCommandId;
    try {
      const headers = { "Content-Type": "application/json" };
      if (authRequired) {
        const token = localStorage.getItem("authToken");
        if (!token) {
          console.error("No auth token found. Please log in again.");
          revertPendingDoorState();
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
        if (commandId === lastCommandId) {
          revertPendingDoorState();
        }
        return;
      }
      console.log(await response.text());

      window.setTimeout(() => {
        if (commandId === lastCommandId && hasPendingDoorState()) {
          getDoorStatus();
        }
      }, 1500);

      window.setTimeout(() => {
        if (commandId === lastCommandId && hasPendingDoorState()) {
          getDoorStatus();
        }
      }, 4500);
    } catch (error) {
      console.error("Error during the request:", error);
      if (commandId === lastCommandId) {
        revertPendingDoorState();
      }
    }
  }

  function updateStatus() {
    const doorSwitch = document.getElementById("doorSwitch");
    const openStatus = document.getElementById("open");
    const closedStatus = document.getElementById("closed");

    if (doorSwitch.checked) {
      openStatus.style.color = "rgba(255, 94, 85, 1)";
      closedStatus.style.color = "#888";
    } else {
      closedStatus.style.color = "rgba(76, 175, 80, 1)";
      openStatus.style.color = "#888";
    }
  }

  function toggleSwitch() {
    const doorSwitch = document.getElementById("doorSwitch");
    const nextDoorOpen = doorSwitch.checked;
    beginPendingDoorState(nextDoorOpen);
    sendCommand(nextDoorOpen ? "open" : "close");
    applyDoorState(nextDoorOpen, "local");
  }

  function manualOpen() {
    beginPendingDoorState(true);
    sendCommand("open");
    applyDoorState(true, "local");
  }

  function manualClose() {
    beginPendingDoorState(false);
    sendCommand("close");
    applyDoorState(false, "local");
  }

  function ringDoorbell() {
    const doorbellInput = document.getElementById("doorbellMessage");
    const message = doorbellInput.value || "Default doorbell ring: Someone rang your doorbell!";
    const token = localStorage.getItem("authToken");
    let headers = { "Content-Type": "application/json" };
    if (authRequired && token) {
      headers["Authorization"] = token;
    }
    const btn = document.getElementById("ringDoorbellButton");
    const feedback = document.getElementById("doorbell-feedback");
    const setFeedback = (text, ok=true) => {
      if (!feedback) return;
      feedback.textContent = text;
      feedback.style.display = "block";
      feedback.style.color = ok ? "#4CAF50" : "#FF5E55";
    };
    btn.disabled = true;
    const prevLabel = btn.textContent;
    btn.textContent = "Sending...";

    fetch("/ring-doorbell", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ message: message })
    })
    .then(async response => {
      let data;
      try { data = await response.json(); } catch { data = {}; }
      if (response.ok && data.ok) {
        setFeedback("Doorbell rung successfully!", true);
        doorbellInput.value = "";
      } else {
        const errMsg = data?.error || `Failed (${response.status})`;
        setFeedback(errMsg, false);
      }
    })
    .catch(error => {
      console.error("Error sending doorbell request:", error);
      setFeedback("Network error sending doorbell.", false);
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = prevLabel;
      setTimeout(() => {
        if (feedback) feedback.style.display = "none";
      }, 4000);
    });
  }

  const doorSwitch = document.getElementById("doorSwitch");
  if (doorSwitch) {
    doorSwitch.addEventListener("change", toggleSwitch);
  } else {
    console.error("doorSwitch element not found");
  }

  const openButton = document.getElementById("manualOpenButton");
  const closeButton = document.getElementById("manualCloseButton");
  if (openButton) {
    openButton.onclick = manualOpen;
  }
  if (closeButton) {
    closeButton.onclick = manualClose;
  }
  
  const ringDoorbellButton = document.getElementById("ringDoorbellButton");
  if (ringDoorbellButton) {
    ringDoorbellButton.onclick = ringDoorbell;
  }

  // ensure doorbell section is always visible 
  document.querySelector("#doorbell-section").style.display = "block";
});
