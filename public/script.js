if (!['localhost', '127.0.0.1'].includes(location.hostname) && location.protocol !== 'https:') {
  location.replace('https://' + location.host + location.pathname + location.search);
}

document.addEventListener('DOMContentLoaded', () => {
  const about = document.getElementById('about-build');
  about.addEventListener('beforetoggle', event => {
    if (event.newState !== 'open') return;
    const bounds = document.getElementById('about-toggle').getBoundingClientRect();
    about.style.right = `${Math.max(16, innerWidth - bounds.right)}px`;
    about.style.bottom = `${Math.max(16, innerHeight - bounds.top + 8)}px`;
  });
  window.addEventListener('resize', () => { if (about.matches(':popover-open')) about.hidePopover(); });
  const toggle = document.getElementById('doorToggle');
  const openButton = document.getElementById('manualOpenButton');
  const closeButton = document.getElementById('manualCloseButton');
  const feedback = document.getElementById('control-feedback');
  let locked = true;
  let busy = false;
  let moving = false;
  let opening = false;
  let doorOpen = null;
  let sse = null;
  let fallbackTimer = null;
  let statusRevision = 0;

  function syncControls() {
    for (const control of [toggle, openButton, closeButton]) {
      control.disabled = locked || busy || moving || doorOpen === null;
    }
    const state = locked ? 'locked' : doorOpen === null ? 'unknown' : doorOpen ? 'open' : 'closed';
    document.body.dataset.doorState = state;
    document.getElementById('login-section').hidden = !locked;
    document.getElementById('door-state').textContent = locked ? 'Protected' : doorOpen === null ? 'Unavailable' : doorOpen ? 'Open' : 'Closed';
    document.getElementById('state-detail').textContent = locked ? 'Enter a password to continue.' : doorOpen === null ? 'The controller is out of reach.' : doorOpen ? 'The handle is held open.' : 'The handle is released.';
    document.getElementById('connection-status').textContent = locked ? 'Password protected' : doorOpen === null ? 'Disconnected' : 'Connected';
    const label = doorOpen ? 'Close door' : 'Open door';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('aria-busy', String(busy || moving));
    document.getElementById('toggle-label').textContent = moving ? opening ? 'Opening…' : 'Closing…' : busy ? 'Sending…' : label;
  }

  document.addEventListener('door-motion', event => {
    moving = event.detail.active;
    opening = event.detail.opening;
    syncControls();
  });

  function showError(message) {
    feedback.textContent = message;
    feedback.hidden = !message;
  }

  function applyDoorState(data) {
    doorOpen = !locked && data.online && typeof data.doorOpen === 'boolean' ? data.doorOpen : null;
    syncControls();
    document.dispatchEvent(new CustomEvent('door-state', { detail: { open: doorOpen } }));
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
        applyDoorState({});
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
    } catch {
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
            applyDoorState({});
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
      document.getElementById('preview-badge').hidden = data.preview !== true;
      locked = data.authRequired && !data.authenticated;
      syncControls();
      showError('');
      if (locked) {
        stopEvents();
        applyDoorState({});
      } else startEvents();
    } catch {
      ++statusRevision;
      stopEvents();
      applyDoorState({});
      showError('Unable to connect. Please try again.');
    }
  }

  document.getElementById('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const errorLabel = document.getElementById('login-error');
    const submit = event.currentTarget.querySelector('button');
    errorLabel.hidden = true;
    submit.disabled = true;
    try {
      await request('/login', { method: 'POST', body: JSON.stringify({ password: document.getElementById('password').value }) });
      document.getElementById('password').value = '';
      localStorage.removeItem('authToken');
      showError('');
      await refreshAuth();
    } catch (error) {
      errorLabel.textContent = error.message;
      errorLabel.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  async function sendCommand(command) {
    if (locked || busy || moving || doorOpen === null) return;
    busy = true;
    showError('');
    syncControls();
    document.dispatchEvent(new CustomEvent('door-command', { detail: { command } }));
    try {
      await request('/command', { method: 'POST', body: JSON.stringify({ command }) });
      await getDoorStatus();
    } catch (error) {
      document.dispatchEvent(new CustomEvent('door-command', { detail: { command: null } }));
      showError(error.message);
    } finally {
      busy = false;
      syncControls();
    }
  }

  toggle.addEventListener('click', () => sendCommand(doorOpen ? 'close' : 'open'));
  openButton.addEventListener('click', () => sendCommand('force-open'));
  closeButton.addEventListener('click', () => sendCommand('force-close'));

  document.getElementById('doorbell-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('ringDoorbellButton');
    const input = document.getElementById('doorbellMessage');
    const result = document.getElementById('doorbell-feedback');
    button.disabled = true;
    result.hidden = true;
    try {
      const data = await request('/ring-doorbell', { method: 'POST', body: JSON.stringify({ message: input.value }) });
      result.textContent = data.message;
      result.classList.remove('error-text');
      input.value = '';
    } catch (error) {
      result.textContent = error.message;
      result.classList.add('error-text');
    } finally {
      button.disabled = false;
      result.hidden = false;
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopEvents();
    else void refreshAuth();
  });
  window.addEventListener('pagehide', stopEvents);
  window.addEventListener('pageshow', refreshAuth);
  setInterval(refreshAuth, 30000);
  void refreshAuth();
});
