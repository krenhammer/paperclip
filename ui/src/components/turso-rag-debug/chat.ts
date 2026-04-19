/**
 * @module turso-rag-debug/chat
 *
 * Chat interface for the Turso Browser RAG debug tool.
 *
 * Provides an interactive chat UI for testing RAG queries
 * and viewing search results.
 *
 * @packageDocumentation
 */

import type { ChatMessage, SearchResult } from './types';
import { state, debugDialog, getTursoRAGInstance } from './state';
import { ICONS } from './icons';
import { escapeHtml, formatTime } from './utils';

/**
 * Add a message to the chat
 *
 * @param role - Message role (user, assistant, system)
 * @param content - Message content
 * @param results - Optional search results to display
 * @public
 */
export async function addChatMessage(role: ChatMessage['role'], content: string, results?: SearchResult[]): Promise<void> {
  const message: ChatMessage = {
    role,
    content,
    timestamp: Date.now(),
    results,
  };

  state.chatMessages.push(message);

  const container = debugDialog?.querySelector('#turso-rag-chat-messages');
  if (!container) return;

  const messageEl = document.createElement('div');
  messageEl.className = `turso-rag-message ${role}`;

  let html = `<div class="turso-rag-message-content">${escapeHtml(content)}</div>`;

  if (role !== 'system') {
    html += `<div class="turso-rag-message-time">${formatTime(message.timestamp)}</div>`;
  }

  // Render search results if present - grouped by file
  if (results && results.length > 0) {
    const groupedResults = groupResultsByFile(results.slice(0, 5));
    const uniqueFiles = Array.from(groupedResults.entries());

    html += '<div class="turso-rag-results">';
    html += `<div class="turso-rag-results-title">Retrieved ${uniqueFiles.length} unique document${uniqueFiles.length > 1 ? 's' : ''}</div>`;

    // Generate unique IDs for this message's collapsible items
    const messageId = `msg-${message.timestamp}`;

    for (let i = 0; i < uniqueFiles.length; i++) {
      const [path, chunks] = uniqueFiles[i]!;
      const topResult = chunks[0]!; // Highest scoring chunk for this file
      const fileId = `${messageId}-file-${i}`;

      // Collapsed header (always visible)
      html += `
        <div class="turso-rag-result-file" data-file-id="${fileId}" id="${fileId}">
          <div class="turso-rag-result-file-header" onclick="this.closest('.turso-rag-result-file').classList.toggle('expanded')">
            <span class="turso-rag-result-toggle">${ICONS['chevron-right']}</span>
            <div class="turso-rag-result-file-info">
              <div class="turso-rag-result-file-name">${escapeHtml(topResult.metadata.title)}</div>
              <div class="turso-rag-result-file-path">${escapeHtml(path)}</div>
            </div>
            <span class="turso-rag-result-file-score">${Math.round(topResult.score * 100)}%</span>
          </div>
          <div class="turso-rag-result-file-content">
            ${chunks.map((chunk, chunkIdx) => `
              <div class="turso-rag-result-chunk">
                <div class="turso-rag-result-chunk-header">Chunk ${chunkIdx + 1} (${Math.round(chunk.score * 100)}%)</div>
                <div class="turso-rag-result-chunk-text">${escapeHtml(chunk.text)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    html += '</div>';
  }

  messageEl.innerHTML = html;
  container.appendChild(messageEl);
  container.scrollTop = container.scrollHeight;
}

/**
 * Group search results by file path, keeping the highest score for each file
 *
 * @param results - Search results to group
 * @returns Grouped results by file path
 * @internal
 */
function groupResultsByFile(results: SearchResult[]): Map<string, SearchResult[]> {
  const grouped = new Map<string, SearchResult[]>();

  for (const result of results) {
    const path = result.metadata.path;
    if (!grouped.has(path)) {
      grouped.set(path, []);
    }
    grouped.get(path)!.push(result);
  }

  // Sort each group's results by score descending
  for (const [, chunks] of grouped) {
    chunks.sort((a, b) => b.score - a.score);
  }

  return grouped;
}

/**
 * Send a chat message and get RAG results
 *
 * @param query - User query string
 * @public
 */
export async function sendChatMessage(query: string): Promise<void> {
  console.log('[turso-rag-debug] sendChatMessage called with query:', query);
  await addChatMessage('user', query);

  try {
    await addChatMessage('system', 'Searching...');

    const tursoRAG = await getTursoRAGInstance();
    console.log('[turso-rag-debug] tursoRAG ready:', tursoRAG.isReady());

    if (!tursoRAG.isReady()) {
      await tursoRAG.initialize();
    }

    // Remove the loading message
    const container = debugDialog?.querySelector('#turso-rag-chat-messages');
    const messages = container?.querySelectorAll('.turso-rag-message.system');
    messages?.forEach(m => {
      if (m.textContent?.includes('Searching')) {
        m.remove();
      }
    });

    console.log('[turso-rag-debug] Calling search with query:', query);
    const results = await tursoRAG.search(query, 5);
    console.log('[turso-rag-debug] Search returned', results.length, 'results');

    if (results.length === 0) {
      await addChatMessage('assistant', 'No relevant documents found for your query.');
    } else {
      const response = formatSearchResultsForChat(results);
      await addChatMessage('assistant', response, results);
    }
  } catch (error) {
    console.error('[turso-rag-debug] Chat search failed:', error);
    await addChatMessage('assistant', `Error: ${error instanceof Error ? error.message : 'Search failed'}`);
    await addChatMessage('system', 'Tip: If search keeps failing, check your internet connection and try refreshing the page.');
  }
}

/**
 * Format search results as a chat response
 *
 * @param results - Search results from RAG
 * @returns Formatted response string
 * @internal
 */
function formatSearchResultsForChat(results: SearchResult[]): string {
  if (results.length === 0) return 'No results found.';

  // Group by file to count unique documents
  const uniquePaths = new Set(results.map(r => r.metadata.path));
  const uniqueCount = uniquePaths.size;

  return `Found ${uniqueCount} relevant document${uniqueCount > 1 ? 's' : ''}. Expand items below to see details.`;
}
