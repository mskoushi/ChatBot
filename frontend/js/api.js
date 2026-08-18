/**
 * api.js — All fetch() calls to the FastAPI backend.
 * No external libraries. All calls are relative to the current host.
 */

const API = (() => {
  const BASE = '';  // Same host — FastAPI serves both frontend and API

  async function _post(path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ detail: res.statusText }));
    if (!res.ok) {
      throw new Error(data.detail || `HTTP ${res.status}`);
    }
    return data;
  }

  async function _delete(path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    return data;
  }

  async function _get(path) {
    const res = await fetch(`${BASE}${path}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    return data;
  }

  /**
   * Fetch backend config (such as google_client_id).
   */
  async function getConfig() {
    return _get('/api/config');
  }

  /**
   * Connect a Google Drive folder.
   * @param {string} folderUrl
   * @param {string|null} sessionId - existing session to reuse
   * @param {string|null} accessToken - optional Google OAuth token
   * @returns {{ session_id, folder_id, folder_name, files, total_files }}
   */
  async function connectFolder(folderUrl, sessionId = null, accessToken = null) {
    return _post('/api/drive/connect', {
      folder_url: folderUrl,
      session_id: sessionId,
      access_token: accessToken,
    });
  }

  /**
   * Select and ingest documents (download from Drive + upload to Gemini).
   * @param {string} sessionId
   * @param {string[]} fileIds - array of Google Drive file IDs
   * @param {string|null} accessToken - optional Google OAuth token
   * @returns {{ success, selected_count, selected_names, message }}
   */
  async function selectDocuments(sessionId, fileIds, accessToken = null) {
    return _post('/api/documents/select', {
      session_id: sessionId,
      file_ids: fileIds,
      access_token: accessToken,
    });
  }

  /**
   * Send a chat message.
   * @param {string} sessionId
   * @param {string} message
   * @returns {{ answer, sources, history }}
   */
  async function sendMessage(sessionId, message) {
    return _post('/api/chat/message', { session_id: sessionId, message });
  }

  /**
   * Clear conversation history and delete Gemini file uploads.
   * @param {string} sessionId
   */
  async function clearSession(sessionId) {
    return _delete('/api/chat/session', { session_id: sessionId });
  }

  /**
   * Get conversation history (for page refresh recovery).
   * @param {string} sessionId
   */
  async function getHistory(sessionId) {
    return _get(`/api/chat/history/${sessionId}`);
  }

  /**
   * Liveness check.
   */
  async function health() {
    return _get('/api/health');
  }

  return { getConfig, connectFolder, selectDocuments, sendMessage, clearSession, getHistory, health };
})();
