/**
 * @module turso-rag-debug/ui
 *
 * UI creation and management for the Turso Browser RAG debug tool.
 *
 * Handles DOM creation, event listeners, and UI updates.
 * Includes draggable non-modal dialog support.
 *
 * @packageDocumentation
 */

import { state, debugDialog, floatingButton, setDebugDialog, setFloatingButton, getTursoRAGInstance, markAutoInitStarted, autoInitStarted } from './state';
import type { InitializationProgress, SearchResult } from './types';
import { ICONS } from './icons';
import { injectStyles } from './styles';
import { checkDebugEnabled } from './utils';
import { addChatMessage } from './chat';
import {
  refreshDocuments,
  showAddDocumentModal,
  showClearDatabaseConfirmModal,
  reloadDocuments
} from './documents';
import { subscribeToInitializationState, getInitializationState } from './turso-rag';

/**
 * Make the dialog draggable by its header
 * @internal
 */
function makeDialogDraggable(dialog: HTMLElement): void {
  const header = dialog.querySelector('#turso-rag-header') as HTMLElement;
  if (!header) return;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  header.style.cursor = 'move';

  header.addEventListener('mousedown', (e: MouseEvent) => {
    // Don't drag if clicking close button
    if ((e.target as HTMLElement).closest('.turso-rag-close')) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    // Get current position from computed style
    const rect = dialog.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    // Change to absolute positioning for dragging
    dialog.style.position = 'fixed';
    dialog.style.left = `${initialLeft}px`;
    dialog.style.top = `${initialTop}px`;
    dialog.style.bottom = 'auto';
    dialog.style.margin = '0';

    e.preventDefault();
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    dialog.style.left = `${initialLeft + deltaX}px`;
    dialog.style.top = `${initialTop + deltaY}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

/**
 * Create the floating action button
 * @internal
 */
export function createFloatingButton(): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'turso-rag-fab';
  btn.id = 'turso-rag-fab';
  btn.innerHTML = ICONS.turso;
  btn.title = 'Open Turso RAG Debug Tool';
  btn.setAttribute('aria-label', 'Open Turso RAG Debug Tool');
  btn.addEventListener('click', toggleDialog);
  return btn;
}

/**
 * Update the floating action button loading state
 *
 * @param progress - Loading progress (0-100)
 * @param isLoading - Whether loading is in progress
 * @public
 */
export function updateFABProgress(progress: number, isLoading: boolean): void {
  const btn = document.getElementById('turso-rag-fab');
  if (!btn) return;

  if (isLoading) {
    btn.classList.add('loading');
    // Update icon to loading spinner if not already loading
    if (!btn.querySelector('.turso-rag-fab-progress')) {
      btn.innerHTML = `${ICONS.loading}<div class="turso-rag-fab-progress"><div class="turso-rag-fab-progress-bar"></div></div>`;
    }
    // Update progress bar
    const progressBar = btn.querySelector('.turso-rag-fab-progress-bar') as HTMLElement;
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
    btn.title = `Loading RAG... ${Math.round(progress)}%`;
  } else {
    btn.classList.remove('loading');
    btn.innerHTML = ICONS.turso;
    btn.title = 'Open Turso RAG Debug Tool';
  }
}

/**
 * Create the debug dialog with tabbed interface
 *
 * @internal
 */
export function createDialog(): HTMLElement {
  const dialog = document.createElement('div');
  dialog.className = 'turso-rag-dialog hidden';
  dialog.id = 'turso-rag-dialog';

  dialog.innerHTML = `
    <div class="turso-rag-header" id="turso-rag-header">
      <h3>${ICONS.turso} Turso Browser RAG</h3>
      <button class="turso-rag-close" aria-label="Close">${ICONS.close}</button>
    </div>

    <div class="turso-rag-tabs">
      <button class="turso-rag-tab active" data-tab="documents">
        ${ICONS.documents} Documents
      </button>
      <button class="turso-rag-tab" data-tab="chat">
        ${ICONS.chat} Chat
      </button>
    </div>

    <div class="turso-rag-content">
      <!-- Documents Panel -->
      <div class="turso-rag-panel active" id="turso-rag-documents-panel">
        <div class="turso-rag-documents-container">
          <!-- Fixed toolbar -->
          <div class="turso-rag-toolbar">
            <button class="turso-rag-btn primary" id="turso-rag-add-doc">
              ${ICONS.plus} Add Document
            </button>
            <button class="turso-rag-btn danger" id="turso-rag-clear">
              ${ICONS.trash} Clear DB
            </button>
            <button class="turso-rag-btn" id="turso-rag-reload">
              ${ICONS.refresh} Refresh
            </button>
          </div>
          <!-- Scrollable tree area -->
          <div class="turso-rag-tree-scroll">
            <div class="turso-rag-tree" id="turso-rag-doc-tree">
              <div class="turso-rag-empty">
                ${ICONS.database}
                <p>Loading documents...</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Panel -->
      <div class="turso-rag-panel" id="turso-rag-chat-panel">
        <div class="turso-rag-chat">
          <div class="turso-rag-chat-messages" id="turso-rag-chat-messages">
            <div class="turso-rag-message system">
              <div class="turso-rag-message-content">
                Welcome to Turso RAG Debug Chat! Type a query to test semantic search against the documentation.
              </div>
            </div>
          </div>
          <div class="turso-rag-chat-input">
            <input
              type="text"
              id="turso-rag-chat-input"
              placeholder="Enter a query to search documentation..."
              autocomplete="off"
            />
            <button id="turso-rag-chat-send" disabled>
              ${ICONS.send} Send
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="turso-rag-status">
      <span class="turso-rag-status-dot" id="turso-rag-status-dot"></span>
      <span id="turso-rag-status-text">Initializing...</span>
      <div class="turso-rag-progress-container" id="turso-rag-progress-container" style="display: none;">
        <div class="turso-rag-progress-bar" id="turso-rag-progress-bar"></div>
      </div>
      <span class="turso-rag-progress-text" id="turso-rag-progress-text"></span>
      <span id="turso-rag-index-size"></span>
    </div>
  `;

  // Event listeners
  dialog.querySelector('.turso-rag-close')?.addEventListener('click', closeDialog);

  dialog.querySelectorAll('.turso-rag-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab') as 'documents' | 'chat'));
  });

  // Document toolbar buttons
  dialog.querySelector('#turso-rag-add-doc')?.addEventListener('click', showAddDocumentModal);
  dialog.querySelector('#turso-rag-clear')?.addEventListener('click', showClearDatabaseConfirmModal);
  dialog.querySelector('#turso-rag-reload')?.addEventListener('click', () => void reloadDocuments());

  // Make dialog draggable via header
  makeDialogDraggable(dialog);

  // Chat input
  const chatInput = dialog.querySelector('#turso-rag-chat-input') as HTMLInputElement;
  const chatSend = dialog.querySelector('#turso-rag-chat-send') as HTMLButtonElement;

  chatInput?.addEventListener('input', () => {
    chatSend.disabled = chatInput.value.trim() === '';
  });

  chatInput?.addEventListener('keypress', (e) => {
    const value = chatInput.value.trim();
    if (e.key === 'Enter' && value) {
      void import('./chat').then(({ sendChatMessage }) => {
        sendChatMessage(value);
      });
      chatInput.value = '';
      chatSend.disabled = true;
    }
  });

  chatSend?.addEventListener('click', () => {
    const value = chatInput.value.trim();
    if (value) {
      void import('./chat').then(({ sendChatMessage }) => {
        sendChatMessage(value);
      });
      chatInput.value = '';
      chatSend.disabled = true;
    }
  });

  return dialog;
}

/**
 * Toggle the debug dialog visibility
 * @public
 */
export function toggleDialog(): void {
  if (state.isOpen) {
    closeDialog();
  } else {
    openDialog();
  }
}

/**
 * Open the debug dialog
 * @public
 */
export function openDialog(): void {
  if (!debugDialog) return;

  debugDialog.classList.remove('hidden');
  state.isOpen = true;

  // Refresh data
  void refreshDocuments();
  void updateStatus();

  // Focus chat input if on chat tab
  if (state.activeTab === 'chat') {
    setTimeout(() => {
      const input = debugDialog?.querySelector('#turso-rag-chat-input') as HTMLInputElement;
      input?.focus();
    }, 100);
  }
}

/**
 * Close the debug dialog
 * @public
 */
export function closeDialog(): void {
  if (!debugDialog) return;

  debugDialog.classList.add('hidden');
  state.isOpen = false;
}

/**
 * Switch between tabs
 *
 * @param tab - Tab to switch to ('documents' or 'chat')
 * @public
 */
export function switchTab(tab: 'documents' | 'chat'): void {
  state.activeTab = tab;

  // Update tab buttons
  debugDialog?.querySelectorAll('.turso-rag-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
  });

  // Update panels
  debugDialog?.querySelectorAll('.turso-rag-panel').forEach((panel) => {
    const isTarget = (panel.id === `turso-rag-${tab}-panel`);
    panel.classList.toggle('active', isTarget);
  });

  // Focus input when switching to chat
  if (tab === 'chat') {
    setTimeout(() => {
      const input = debugDialog?.querySelector('#turso-rag-chat-input') as HTMLInputElement;
      input?.focus();
    }, 100);
  }
}

/**
 * Update status bar with custom message
 *
 * @param message - Status message to display
 * @param type - Status type ('loading', 'error', 'ready')
 * @public
 */
export function updateStatusMessage(message: string, type: 'loading' | 'error' | 'ready'): void {
  const dot = debugDialog?.querySelector('#turso-rag-status-dot');
  const text = debugDialog?.querySelector('#turso-rag-status-text');

  if (!dot || !text) return;

  text.textContent = message;

  switch (type) {
    case 'loading':
      dot.className = 'turso-rag-status-dot loading';
      break;
    case 'error':
      dot.className = 'turso-rag-status-dot error';
      break;
    case 'ready':
      dot.className = 'turso-rag-status-dot';
      break;
  }
}

/**
 * Update progress bar in the status bar
 *
 * @param progress - Progress percentage (0-100)
 * @param message - Optional message to display
 * @public
 */
export function updateProgressBar(progress: number, message?: string): void {
  const progressContainer = debugDialog?.querySelector('#turso-rag-progress-container') as HTMLElement;
  const progressBar = debugDialog?.querySelector('#turso-rag-progress-bar') as HTMLElement;
  const progressText = debugDialog?.querySelector('#turso-rag-progress-text') as HTMLElement;
  const statusText = debugDialog?.querySelector('#turso-rag-status-text');

  if (!progressContainer || !progressBar || !progressText) return;

  if (progress > 0 && progress < 100) {
    progressContainer.style.display = 'block';
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${Math.round(progress)}%`;
  } else {
    progressContainer.style.display = 'none';
    progressText.textContent = '';
  }

  if (message && statusText) {
    statusText.textContent = message;
  }
}

/**
 * Update the status bar with current RAG state
 * @public
 */
export async function updateStatus(): Promise<void> {
  const dot = debugDialog?.querySelector('#turso-rag-status-dot');
  const text = debugDialog?.querySelector('#turso-rag-status-text');
  const sizeEl = debugDialog?.querySelector('#turso-rag-index-size');

  if (!dot || !text) return;

  // Check global initialization state
  const initState = getInitializationState();

  if (state.isLoading || initState.isInitializing) {
    dot.className = 'turso-rag-status-dot loading';
    text.textContent = initState.message || 'Loading...';
    if (initState.progress > 0 && initState.progress < 100) {
      updateProgressBar(initState.progress);
    }
    return;
  }

  try {
    const tursoRAG = await getTursoRAGInstance();

    if (!tursoRAG.isReady()) {
      dot.className = 'turso-rag-status-dot error';
      text.textContent = initState.error || 'RAG not initialized';
      updateProgressBar(0);
      return;
    }

    const size = await tursoRAG.getIndexSize();
    dot.className = 'turso-rag-status-dot';
    text.textContent = 'Turso Browser RAG Ready';
    if (sizeEl) {
      sizeEl.textContent = `| ${size} chunks indexed`;
    }
    updateProgressBar(100);
  } catch (error) {
    dot.className = 'turso-rag-status-dot error';
    text.textContent = 'RAG Error';
    updateProgressBar(0);
    console.error('[turso-rag-debug] Status update failed:', error);
  }
}

/**
 * Initialize the RAG debug tool
 * Only runs if VITE_TURSO_RAG_DEBUG is enabled
 *
 * @param opts - Optional configuration
 * @param opts.showFab - Whether to create a floating action button (default: false, React component handles button)
 * @public
 */
export function initializeTursoRagDebug(opts?: { showFab?: boolean }): void {
  // Check if debug mode is enabled
  const isDebugEnabled = checkDebugEnabled();
  if (!isDebugEnabled) {
    console.log('[turso-rag-debug] Debug mode not enabled. Set VITE_TURSO_RAG_DEBUG=true to enable.');
    return;
  }

  // Check if already initialized (elements exist in DOM)
  if (document.getElementById('turso-rag-fab') || document.getElementById('turso-rag-dialog')) {
    console.log('[turso-rag-debug] Already initialized, skipping...');
    return;
  }

  console.log('[turso-rag-debug] Initializing Turso RAG debug tool...');

  // Inject styles
  injectStyles();

  // Create dialog
  const dialog = createDialog();
  setDebugDialog(dialog);
  document.body.appendChild(dialog);

  // Optionally create floating action button (default: false, use React component instead)
  if (opts?.showFab) {
    const fab = createFloatingButton();
    setFloatingButton(fab);
    document.body.appendChild(fab);

    // Subscribe to initialization state changes for FAB UI updates
    subscribeToInitializationState((initState) => {
      updateFABProgress(initState.progress, initState.isInitializing && initState.stage !== 'complete');
    });
  }

  // Restore active tab state
  if (state.activeTab) {
    switchTab(state.activeTab);
  }

  // Auto-initialize RAG on page load (non-blocking)
  if (!autoInitStarted) {
    markAutoInitStarted();
    console.log('[turso-rag-debug] Auto-initializing RAG on page load...');

    // Initialize RAG with progress updates logged to console
    getTursoRAGInstance().then((tursoRAG) => {
      tursoRAG.initialize((progress: InitializationProgress) => {
        console.log(`[turso-rag-debug] RAG loading: ${progress.progress}% - ${progress.message}`);
      }).then(() => {
        console.log('[turso-rag-debug] RAG auto-initialization complete');
        // Refresh the document list if dialog is open
        if (state.isOpen) {
          void refreshDocuments();
        }
      }).catch((error: unknown) => {
        console.error('[turso-rag-debug] RAG auto-initialization failed:', error);
      });
    });
  }

  // Initial status update
  void updateStatus();

  console.log('[turso-rag-debug] Turso RAG debug tool initialized.');
}

/**
 * Open the chat tab with a specific query and results.
 * Used by the voice agent to show RAG search results in the debug UI.
 *
 * @param query - The search query
 * @param results - Optional search results to display
 * @public
 */
export function openChatWithQuery(query?: string, results?: SearchResult[]): void {
  // Ensure dialog is created and open
  if (!debugDialog) {
    createDialog();
  }

  if (!state.isOpen) {
    openDialog();
  }

  // Switch to chat tab
  switchTab('chat');

  // If query provided, add it as a user message
  if (query) {
    void addChatMessage('user', query, results);
  }
}

/**
 * Programmatically enable/disable the debug tool
 * For use from browser console
 *
 * @param enabled - Whether to enable or disable
 * @public
 */
export function setDebugEnabled(enabled: boolean): void {
  try {
    localStorage.setItem('paperclip-turso-rag-debug-force', enabled ? 'true' : 'false');
    window.location.reload();
  } catch (error) {
    console.error('[turso-rag-debug] Failed to set debug mode:', error);
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as typeof window & {
    __tursoRagDebug?: {
      initialize: typeof initializeTursoRagDebug;
      setEnabled: typeof setDebugEnabled;
      open: typeof openDialog;
      close: typeof closeDialog;
    };
  }).__tursoRagDebug = {
    initialize: initializeTursoRagDebug,
    setEnabled: setDebugEnabled,
    open: openDialog,
    close: closeDialog,
  };
}
