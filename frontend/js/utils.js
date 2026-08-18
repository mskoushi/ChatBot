/**
 * utils.js — Shared utilities
 * Lightweight Markdown → HTML renderer (no external deps)
 * Handles: tables, bold, italic, code, headings, lists, line breaks
 */

const Utils = (() => {

  /** Escape HTML special chars to prevent XSS in user-provided text */
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Render Markdown text to safe HTML.
   * Handles the patterns Gemini most commonly outputs:
   *   - ATX headings (# ## ###)
   *   - Bold (**text**) and italic (*text*)
   *   - Inline code (`code`)
   *   - Code fences (``` ... ```)
   *   - Tables (| col | col |)
   *   - Unordered lists (- or *)
   *   - Ordered lists (1. 2.)
   *   - Horizontal rules (---)
   *   - Paragraphs / line breaks
   */
  function renderMarkdown(text) {
    if (!text) return '';

    let html = text;

    // 1. Code fences — process first before other rules
    html = html.replace(/```(?:\w+)?\n([\s\S]*?)```/g, (_, code) =>
      `<pre><code>${escapeHtml(code.trim())}</code></pre>`
    );

    // 2. Tables — detect pipe-delimited rows
    html = renderTables(html);

    // 3. Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 4. Horizontal rules
    html = html.replace(/^[-*_]{3,}$/gm, '<hr>');

    // 5. Unordered lists
    html = renderUnorderedLists(html);

    // 6. Ordered lists
    html = renderOrderedLists(html);

    // 7. Inline: bold+italic (***text***)
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // 8. Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // 9. Italic
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    // 10. Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 11. Paragraphs — blank-line separated blocks not already wrapped in block tags
    html = wrapParagraphs(html);

    return html;
  }

  function renderTables(text) {
    const lines = text.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Detect table: line contains | and next line is separator (---|---|)
      if (line.includes('|') && i + 1 < lines.length && /^\|?\s*[-:]+\s*\|/.test(lines[i + 1])) {
        // Collect all table rows
        const tableLines = [];
        while (i < lines.length && lines[i].includes('|')) {
          tableLines.push(lines[i]);
          i++;
        }

        const rows = tableLines.map(row =>
          row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || arr.length === 1)
             .map(cell => cell.trim())
        );

        // First row = headers, second = separator (skip), rest = body
        const headers = rows[0];
        const bodyRows = rows.slice(2);

        let tableHtml = '<div class="md-table-wrap"><table><thead><tr>';
        tableHtml += headers.map(h => `<th>${h}</th>`).join('');
        tableHtml += '</tr></thead><tbody>';
        tableHtml += bodyRows.map(cells =>
          '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>'
        ).join('');
        tableHtml += '</tbody></table></div>';

        result.push(tableHtml);
      } else {
        result.push(line);
        i++;
      }
    }

    return result.join('\n');
  }

  function renderUnorderedLists(text) {
    return text.replace(/(?:^[-*+] .+\n?)+/gm, match => {
      const items = match.trim().split('\n').map(l => l.replace(/^[-*+] /, '').trim());
      return '<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>';
    });
  }

  function renderOrderedLists(text) {
    return text.replace(/(?:^\d+\. .+\n?)+/gm, match => {
      const items = match.trim().split('\n').map(l => l.replace(/^\d+\. /, '').trim());
      return '<ol>' + items.map(i => `<li>${i}</li>`).join('') + '</ol>';
    });
  }

  function wrapParagraphs(html) {
    const BLOCK_TAGS = /^<(h[1-6]|ul|ol|li|pre|hr|div|table|thead|tbody|tr|th|td)/;
    return html
      .split(/\n\n+/)
      .map(block => {
        block = block.trim();
        if (!block) return '';
        if (BLOCK_TAGS.test(block)) return block;
        // Convert single newlines within a paragraph to <br>
        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
      })
      .join('\n');
  }

  /** Format bytes to human readable */
  function formatSize(bytes) {
    if (!bytes) return '';
    const n = parseInt(bytes, 10);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  /** Show a transient toast notification */
  function toast(message, type = 'error', duration = 4000) {
    const existing = document.getElementById('toast-container');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position:fixed; bottom:20px; right:20px; z-index:9999;
      background:${type === 'error' ? '#7f1d1d' : '#14532d'};
      border:1px solid ${type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'};
      color:${type === 'error' ? '#fca5a5' : '#86efac'};
      padding:12px 18px; border-radius:10px;
      font-size:13px; max-width:360px; line-height:1.5;
      box-shadow:0 8px 30px rgba(0,0,0,0.5);
      animation:toastIn 0.2s ease-out;
    `;
    const style = document.createElement('style');
    style.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}';
    document.head.appendChild(style);
    container.textContent = message;
    document.body.appendChild(container);
    setTimeout(() => container.remove(), duration);
  }

  return { renderMarkdown, escapeHtml, formatSize, toast };
})();
