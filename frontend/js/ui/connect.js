/**
 * ui/connect.js — Connect screen UI logic
 */

const ConnectUI = (() => {

  let _onConnect = null; // callback(data) when folder connects successfully

  function init(onConnectCallback) {
    _onConnect = onConnectCallback;

    const input = document.getElementById('folder-url');
    const btn   = document.getElementById('btn-connect');

    // Allow Enter key in input
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') _handleConnect();
    });

    btn.addEventListener('click', _handleConnect);

    // Auto-focus
    input.focus();
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
      const data = await API.connectFolder(url, sessionId);
      _setLoading(false);
      _onConnect(data);
    } catch (err) {
      _setLoading(false);
      _showError(err.message || 'Could not connect to the folder. Please try again.');
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

  return { init, setUrl };
})();
