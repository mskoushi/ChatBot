/**
 * ui/chat.js — Chat screen UI logic
 * Renders messages, handles input, loading states, markdown, and sources.
 */

const ChatUI = (() => {

  let _onNewChat = null;
  let _isSending = false;

  function init(onNewChatCallback) {
    _onNewChat = onNewChatCallback;

    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-send');

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 160) + 'px';
      sendBtn.disabled = !input.value.trim() || _isSending;
    });

    // Send on Enter (Shift+Enter = newline)
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _handleSend();
      }
    });

    sendBtn.addEventListener('click', _handleSend);

    document.getElementById('btn-new-chat').addEventListener('click', () => {
      if (_onNewChat) _onNewChat();
    });
  }

  /** Set header info when entering chat view */
  function setContext(folderName, selectedNames) {
    document.getElementById('chat-folder-name').textContent = folderName || 'Chat';
    const n = selectedNames ? selectedNames.length : 0;
    document.getElementById('chat-docs-label').textContent =
      n > 0 ? `${n} document${n !== 1 ? 's' : ''} loaded` : '';
  }

  /** Show the welcome / empty state */
  function showEmptyState(selectedNames) {
    const container = document.getElementById('chat-messages');
    const docsText = selectedNames && selectedNames.length > 0
      ? selectedNames.map(n => `<span style="color:var(--accent)">• ${Utils.escapeHtml(n)}</span>`).join('<br>')
      : 'your selected documents';

    container.innerHTML = `
      <div class="chat-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <strong>Ready to answer your questions</strong>
        <p>Documents loaded:<br>${docsText}</p>
        <p style="margin-top:8px">Try: <em>"Summarize the main document"</em> or <em>"Compare all records in a table"</em></p>
      </div>
    `;

    _clearError();
    _focusInput();
  }

  /** Restore conversation history (e.g. after back/forward navigation) */
  function restoreHistory(history) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    history.forEach(msg => {
      appendMessage(msg.role, msg.content, msg.sources || []);
    });
    _scrollToBottom();
  }

  /** Append a single message to the conversation */
  function appendMessage(role, content, sources = []) {
    const container = document.getElementById('chat-messages');

    // Remove empty state if present
    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    const row = document.createElement('div');
    row.className = `msg-row ${role}`;

    const isUser = role === 'user';

    const avatarLabel = isUser ? 'U' : 'AI';
    const avatarClass = isUser ? 'user-av' : 'ai-av';

    const bubbleContent = isUser
      ? Utils.escapeHtml(content).replace(/\n/g, '<br>')
      : Utils.renderMarkdown(content);

    const sourcesHtml = (!isUser && sources && sources.length > 0)
      ? `<div class="msg-sources">
           <span class="sources-label">Sources:</span>
           ${sources.map(s => `
             <span class="source-pill">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                 <polyline points="14 2 14 8 20 8"/>
               </svg>
               ${Utils.escapeHtml(s)}
             </span>`).join('')}
         </div>`
      : '';

    row.innerHTML = `
      <div class="msg-avatar ${avatarClass}">${avatarLabel}</div>
      <div class="msg-bubble-wrap">
        <div class="msg-bubble ${isUser ? 'user' : 'ai'}">${bubbleContent}</div>
        ${sourcesHtml}
      </div>
    `;

    container.appendChild(row);
    _scrollToBottom();
    return row;
  }

  /** Append a loading (typing) indicator; returns the element so it can be replaced */
  function appendLoading() {
    const container = document.getElementById('chat-messages');

    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    const row = document.createElement('div');
    row.className = 'msg-row assistant';
    row.id = 'msg-loading';
    row.innerHTML = `
      <div class="msg-avatar ai-av">AI</div>
      <div class="msg-bubble-wrap">
        <div class="msg-bubble ai">
          <div class="loading-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
    `;
    container.appendChild(row);
    _scrollToBottom();
    return row;
  }

  /** Replace the loading indicator with the actual response */
  function replaceLoading(answer, sources) {
    const loading = document.getElementById('msg-loading');
    if (loading) loading.remove();
    appendMessage('assistant', answer, sources);
  }

  async function _handleSend() {
    if (_isSending) return;

    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    _isSending = true;
    _setSendingState(true);
    _clearError();

    // Show user message immediately
    appendMessage('user', message);
    input.value = '';
    input.style.height = 'auto';

    // Show loading indicator
    appendLoading();

    try {
      const data = await API.sendMessage(App.state.sessionId, message);
      replaceLoading(data.answer, data.sources);
    } catch (err) {
      const loading = document.getElementById('msg-loading');
      if (loading) loading.remove();
      _showError(err.message || 'Failed to get a response. Please try again.');
    } finally {
      _isSending = false;
      _setSendingState(false);
      _focusInput();
    }
  }

  function _setSendingState(sending) {
    const sendBtn = document.getElementById('btn-send');
    const input   = document.getElementById('chat-input');
    sendBtn.disabled = sending;
    input.disabled   = sending;
  }

  function _scrollToBottom() {
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
  }

  function _focusInput() {
    setTimeout(() => {
      const input = document.getElementById('chat-input');
      input.disabled = false;
      input.focus();
    }, 50);
  }

  function _showError(msg) {
    const el = document.getElementById('chat-error');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 6000);
  }

  function _clearError() {
    document.getElementById('chat-error').classList.add('hidden');
  }

  return {
    init,
    setContext,
    showEmptyState,
    restoreHistory,
    appendMessage,
    appendLoading,
    replaceLoading,
  };
})();
