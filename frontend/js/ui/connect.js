/**
 * ui/connect.js — Connect screen UI logic with optional Google OAuth 2.0 authorization.
 */

const ConnectUI = (() => {

  let _onConnect = null;
  let _accessToken = null;
  let _tokenClient = null;
  let _googleClientId = null;

  async function init(onConnectCallback) {
    _onConnect = onConnectCallback;

    const input   = document.getElementById('folder-url');
    const btn     = document.getElementById('btn-connect');
    const authBtn = document.getElementById('btn-google-auth');
    const reauthBtn = document.getElementById('btn-reauth');

    // Fetch config to check if google_client_id is available
    try {
      const config = await API.getConfig();
      if (config.google_client_id) {
        _googleClientId = config.google_client_id;
        _initGoogleAuth();
      }
    } catch (_) {}

    // Allow Enter key in input
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') _handleConnect();
    });

    btn.addEventListener('click', _handleConnect);
    authBtn.addEventListener('click', _requestGoogleToken);
    reauthBtn?.addEventListener('click', _requestGoogleToken);

    // Auto-focus
    input.focus();
  }

  function _initGoogleAuth() {
    if (!window.google || !google.accounts || !google.accounts.oauth2) {
      // Retry after GIS script loads
      setTimeout(_initGoogleAuth, 300);
      return;
    }

    try {
      _tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: _googleClientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            _accessToken = tokenResponse.access_token;
            _updateAuthUI(true);
            _clearError();
            Utils.toast('Google Drive authorized successfully!', 'success');
          } else if (tokenResponse.error) {
            _showError(`Google Auth failed: ${tokenResponse.error}`);
          }
        },
      });

      // Show authorize button
      const authBtn = document.getElementById('btn-google-auth');
      authBtn.classList.remove('hidden');
    } catch (e) {
      console.warn('Could not initialize Google OAuth client:', e);
    }
  }

  function _requestGoogleToken() {
    if (_tokenClient) {
      _tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      _showError('Google Authorization is still loading. Please wait a moment and try again.');
    }
  }

  function _updateAuthUI(authorized) {
    const authBtn    = document.getElementById('btn-google-auth');
    const statusBar  = document.getElementById('auth-status-bar');
    if (authorized) {
      authBtn.classList.add('hidden');
      statusBar.classList.remove('hidden');
    } else {
      authBtn.classList.remove('hidden');
      statusBar.classList.add('hidden');
    }
  }

  async function _handleConnect() {
    const input = document.getElementById('folder-url');
    const url = input.value.trim();

    if (!url) {
      _showError('Please paste a Google Drive folder URL.');
      input.focus();
      return;
    }

    if (!url.includes('drive.google.com')) {
      _showError('That doesn\'t look like a Google Drive URL. Please paste the full folder link.');
      return;
    }

    _setLoading(true);
    _clearError();

    try {
      const sessionId = App.state.sessionId;
      const data = await API.connectFolder(url, sessionId, _accessToken);
      _setLoading(false);
      _onConnect(data);
    } catch (err) {
      _setLoading(false);
      _showError(err.message || 'Could not connect to the folder. Please verify the link or Authorize with Google.');
    }
  }

  function _setLoading(loading) {
    const btn    = document.getElementById('btn-connect');
    const text   = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    const input  = document.getElementById('folder-url');

    btn.disabled = loading;
    input.disabled = loading;
    text.classList.toggle('hidden', loading);
    loader.classList.toggle('hidden', !loading);
  }

  function _showError(msg) {
    const el = document.getElementById('connect-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function _clearError() {
    const el = document.getElementById('connect-error');
    el.classList.add('hidden');
    el.textContent = '';
  }

  /** Pre-fill the input field (e.g. from a stored URL) */
  function setUrl(url) {
    document.getElementById('folder-url').value = url || '';
  }

  function getAccessToken() {
    return _accessToken;
  }

  return { init, setUrl, getAccessToken };
})();
