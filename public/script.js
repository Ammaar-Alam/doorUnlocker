if (!['localhost', '127.0.0.1'].includes(location.hostname) && location.protocol !== 'https:') {
  location.replace('https://' + location.host + location.pathname + location.search);
}

document.addEventListener("DOMContentLoaded", () => {
  const doorSwitch = document.getElementById("doorSwitch");
  const openButton = document.getElementById("manualOpenButton");
  const closeButton = document.getElementById("manualCloseButton");
  const feedback = document.getElementById("control-feedback");
  let locked = true;
  let busy = false;
  let doorOpen = null;
  let sse = null;
  let fallbackTimer = null;
  let statusRevision = 0;

  function syncControls() {
    for (const control of [doorSwitch, openButton, closeButton]) {
      control.disabled = locked || busy || doorOpen === null;
    }
    document.querySelector('.control-panel').classList.toggle('locked', locked);
    document.getElementById('controls-overlay').style.display = locked ? 'flex' : 'none';
    document.getElementById('login-section').style.display = locked ? 'block' : 'none';
  }

  function showError(message) {
    feedback.textContent = message;
    feedback.hidden = !message;
  }

  function applyDoorState(data) {
    doorOpen = data.online && typeof data.doorOpen === 'boolean' ? data.doorOpen : null;
    doorSwitch.indeterminate = doorOpen === null;
    doorSwitch.checked = doorOpen === true;
    document.getElementById('open').style.color = doorOpen === true ? '#FF5E55' : '#888';
    document.getElementById('closed').style.color = doorOpen === false ? '#4CAF50' : '#888';
    document.getElementById('connection-status').textContent = doorOpen === null ? 'Status unavailable' : '';
    syncControls();
  }

  async function request(path, options = {}) {
    const response = await fetch(path, {
      ...options, headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        locked = true;
        stopEvents();
        syncControls();
      }
      throw new Error(data.message || 'Request failed');
    }
    return data;
  }

  function stopEvents() {
    sse?.close();
    sse = null;
    clearInterval(fallbackTimer);
    fallbackTimer = null;
  }

  async function getDoorStatus() {
    const revision = ++statusRevision;
    try {
      const data = await request('/status');
      if (revision === statusRevision) applyDoorState(data);
    } catch (error) {
      if (revision === statusRevision) applyDoorState({});
    }
  }

  function startEvents() {
    if (sse || document.hidden) return;
    if (!fallbackTimer) fallbackTimer = setInterval(getDoorStatus, 4000);
    try {
      sse = new EventSource('/events');
      sse.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.authRequired) {
            locked = true;
            stopEvents();
            syncControls();
            return;
          }
          clearInterval(fallbackTimer);
          fallbackTimer = null;
          ++statusRevision;
          applyDoorState(data);
        } catch {
          applyDoorState({});
        }
      };
      sse.onerror = () => {
        ++statusRevision;
        applyDoorState({});
        if (!fallbackTimer) fallbackTimer = setInterval(getDoorStatus, 4000);
      };
    } catch {
      sse = null;
    }
  }

  async function refreshAuth() {
    if (document.hidden) return;
    try {
      const data = await request('/auth-status');
      locked = data.authRequired && !data.authenticated;
      syncControls();
      if (locked) stopEvents();
      else startEvents();
    } catch {
      locked = true;
      stopEvents();
      applyDoorState({});
      showError('Unable to connect. Please try again.');
    }
  }

  document.getElementById('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const errorLabel = document.getElementById('login-error');
    errorLabel.style.display = 'none';
    try {
      await request('/login', { method: 'POST', body: JSON.stringify({ password: document.getElementById('password').value }) });
      document.getElementById('password').value = '';
      localStorage.removeItem('authToken');
      showError('');
      await refreshAuth();
    } catch (error) {
      errorLabel.textContent = error.message;
      errorLabel.style.display = 'block';
    }
  });

  async function sendCommand(command) {
    if (locked || busy || doorOpen === null) return;
    busy = true;
    showError('');
    syncControls();
    try {
      await request('/command', { method: 'POST', body: JSON.stringify({ command }) });
      await getDoorStatus();
    } catch (error) {
      showError(error.message);
    } finally {
      busy = false;
      syncControls();
    }
  }

  doorSwitch.addEventListener('change', () => {
    const command = doorSwitch.checked ? 'open' : 'close';
    doorSwitch.checked = doorOpen === true;
    void sendCommand(command);
  });
  openButton.addEventListener('click', () => sendCommand('force-open'));
  closeButton.addEventListener('click', () => sendCommand('force-close'));

  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(navLinks.classList.contains('open')));
  });
  document.addEventListener('click', event => {
    if (!navLinks.contains(event.target) && !navToggle.contains(event.target)) {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });

  const bellButton = document.getElementById('ringDoorbellButton');
  bellButton.addEventListener('click', async () => {
    const input = document.getElementById('doorbellMessage');
    const result = document.getElementById('doorbell-feedback');
    bellButton.disabled = true;
    result.style.display = 'block';
    try {
      const data = await request('/ring-doorbell', { method: 'POST', body: JSON.stringify({ message: input.value }) });
      result.textContent = data.message;
      result.style.color = '#4CAF50';
      input.value = '';
    } catch (error) {
      result.textContent = error.message;
      result.style.color = '#FF5E55';
    } finally {
      bellButton.disabled = false;
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopEvents();
    else void refreshAuth();
  });
  window.addEventListener('pagehide', stopEvents);
  window.addEventListener('pageshow', refreshAuth);
  setInterval(refreshAuth, 30000);
  syncControls();
  void refreshAuth();
});
