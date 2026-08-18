/**
 * app.js — Central application state machine.
 * Manages view transitions and shared state.
 * Loaded last (after all other scripts).
 */

const App = (() => {

  // ── Shared application state ───────────────────────────────────────────────
  const state = {
    sessionId:     null,
    folderUrl:     null,
    folderName:    null,
    files:         [],
    selectedNames: [],
  };

  // ── View management ────────────────────────────────────────────────────────

  const VIEWS = {
    CONNECT:   'view-connect',
    DOCUMENTS: 'view-documents',
    CHAT:      'view-chat',
  };

  function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // ── Transition handlers ────────────────────────────────────────────────────

  /** Called when the user successfully connects a Drive folder */
  function onFolderConnected(data) {
    state.sessionId  = data.session_id;
    state.folderName = data.folder_name;
    state.files      = data.files;
    state.folderUrl  = document.getElementById('folder-url').value.trim();

    // Persist session to sessionStorage for in-tab refresh recovery
    _saveSession();

    DocumentsUI.render(data);
    showView(VIEWS.DOCUMENTS);
  }

  /** Called when the user clicks Start Chat after selecting documents */
  function onDocumentsSelected(data) {
    state.selectedNames = data.selected_names || [];

    ChatUI.setContext(state.folderName, state.selectedNames);
    ChatUI.showEmptyState(state.selectedNames);
    showView(VIEWS.CHAT);
  }

  /** Called when the user clicks "New Chat" */
  async function onNewChat() {
    if (!state.sessionId) return;
    try {
      await API.clearSession(state.sessionId);
    } catch (_) { /* ignore */ }
    ChatUI.showEmptyState(state.selectedNames);
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goToConnect() {
    showView(VIEWS.CONNECT);
    ConnectUI.setUrl(state.folderUrl || '');
  }

  function goToDocuments() {
    showView(VIEWS.DOCUMENTS);
  }

  // ── Session persistence (sessionStorage) ───────────────────────────────────

  const SESSION_KEY = 'doc_chatbot_session';

  function _saveSession() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        sessionId:   state.sessionId,
        folderUrl:   state.folderUrl,
        folderName:  state.folderName,
      }));
    } catch (_) {}
  }

  async function _restoreSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved.sessionId) return false;

      // Check if the session is still valid on the server
      const hist = await API.getHistory(saved.sessionId);
      if (!hist || hist.selected_files === undefined) return false;

      // Restore state
      state.sessionId  = saved.sessionId;
      state.folderUrl  = saved.folderUrl;
      state.folderName = saved.folderName || 'Documents';
      state.selectedNames = hist.selected_files || [];

      if (hist.history && hist.history.length > 0 && state.selectedNames.length > 0) {
        // Restore into chat view
        ChatUI.setContext(state.folderName, state.selectedNames);
        ChatUI.restoreHistory(hist.history);
        showView(VIEWS.CHAT);
        return true;
      }

      return false;
    } catch (_) {
      return false;
    }
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  async function init() {
    // Wire up back buttons
    document.getElementById('btn-back-connect').addEventListener('click', goToConnect);
    document.getElementById('btn-back-docs').addEventListener('click', goToDocuments);

    // Init UI modules
    ConnectUI.init(onFolderConnected);
    DocumentsUI.init(onDocumentsSelected);
    ChatUI.init(onNewChat);

    // Try to restore an in-progress session
    const restored = await _restoreSession();
    if (!restored) {
      showView(VIEWS.CONNECT);
    }
  }

  // Kick off once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose state for UI modules to read
  return { state };

})();
