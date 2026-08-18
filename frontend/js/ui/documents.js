/**
 * ui/documents.js — Document selection screen UI logic
 */

const DocumentsUI = (() => {

  let _files = [];
  let _selectedIds = new Set();
  let _onStartChat = null;

  function init(onStartChatCallback) {
    _onStartChat = onStartChatCallback;

    document.getElementById('btn-select-all').addEventListener('click', _selectAll);
    document.getElementById('btn-deselect-all').addEventListener('click', _deselectAll);
    document.getElementById('btn-start-chat').addEventListener('click', _handleStartChat);
  }

  /** Render the document list from a connect response */
  function render(data) {
    _files = data.files || [];
    _selectedIds = new Set(_files.map(f => f.id)); // Select all by default

    document.getElementById('folder-name').textContent = data.folder_name || 'Documents';
    document.getElementById('file-count').textContent = `${data.total_files} PDF${data.total_files !== 1 ? 's' : ''} found`;

    _renderList();
    _updateToolbar();
    _clearError();
  }

  function _renderList() {
    const container = document.getElementById('file-list');
    container.innerHTML = '';

    if (_files.length === 0) {
      container.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-muted)">No PDF files found.</p>';
      return;
    }

    _files.forEach(file => {
      const item = document.createElement('label');
      item.className = 'file-item';
      item.htmlFor = `file-${file.id}`;

      const checked = _selectedIds.has(file.id) ? 'checked' : '';
      const size = Utils.formatSize(file.size);
      const modified = file.modifiedTime
        ? new Date(file.modifiedTime).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' })
        : '';
      const meta = [size, modified].filter(Boolean).join(' · ');

      item.innerHTML = `
        <input type="checkbox" class="file-checkbox" id="file-${file.id}" data-id="${file.id}" ${checked} />
        <div class="file-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="file-info">
          <div class="file-name">${Utils.escapeHtml(file.name)}</div>
          ${meta ? `<div class="file-meta">${meta}</div>` : ''}
        </div>
      `;

      const checkbox = item.querySelector('.file-checkbox');
      checkbox.addEventListener('change', e => {
        e.stopPropagation();
        if (checkbox.checked) {
          _selectedIds.add(file.id);
        } else {
          _selectedIds.delete(file.id);
        }
        _updateToolbar();
      });

      // Clicking the row toggles the checkbox
      item.addEventListener('click', e => {
        if (e.target === checkbox) return; // already handled
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      });

      container.appendChild(item);
    });
  }

  function _selectAll() {
    _selectedIds = new Set(_files.map(f => f.id));
    document.querySelectorAll('.file-checkbox').forEach(cb => { cb.checked = true; });
    _updateToolbar();
  }

  function _deselectAll() {
    _selectedIds.clear();
    document.querySelectorAll('.file-checkbox').forEach(cb => { cb.checked = false; });
    _updateToolbar();
  }

  function _updateToolbar() {
    const n = _selectedIds.size;
    const badge = document.getElementById('selected-count');
    badge.textContent = n > 0 ? `${n} selected` : 'None selected';

    const btn = document.getElementById('btn-start-chat');
    btn.disabled = n === 0;
  }

  async function _handleStartChat() {
    if (_selectedIds.size === 0) return;

    _setLoading(true);
    _clearError();

    try {
      const data = await API.selectDocuments(App.state.sessionId, [..._selectedIds]);
      _setLoading(false);
      _onStartChat(data);
    } catch (err) {
      _setLoading(false);
      _showError(err.message || 'Failed to load documents. Please try again.');
    }
  }

  function _setLoading(loading) {
    const btn    = document.getElementById('btn-start-chat');
    const text   = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');

    btn.disabled = loading;
    text.classList.toggle('hidden', loading);
    loader.classList.toggle('hidden', !loading);

    document.getElementById('btn-select-all').disabled = loading;
    document.getElementById('btn-deselect-all').disabled = loading;
    document.querySelectorAll('.file-checkbox').forEach(cb => { cb.disabled = loading; });
  }

  function _showError(msg) {
    const el = document.getElementById('docs-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function _clearError() {
    const el = document.getElementById('docs-error');
    el.classList.add('hidden');
    el.textContent = '';
  }

  function getSelectedIds() { return [..._selectedIds]; }

  return { init, render, getSelectedIds };
})();
