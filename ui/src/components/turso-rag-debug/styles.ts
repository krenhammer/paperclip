/**
 * @module turso-rag-debug/styles
 *
 * CSS styles for the Turso Browser RAG debug tool UI.
 *
 * The documents panel uses a flex layout where:
 * - Toolbar stays fixed at the top
 * - Document tree is scrollable
 *
 * @packageDocumentation
 */

/**
 * CSS styles string for the debug tool.
 * Injected into the document head on initialization.
 *
 * @public
 */
export const DEBUG_STYLES = `
  /* Floating Action Button */
  .turso-rag-fab {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
    transition: all 0.3s ease;
    z-index: 50;
    pointer-events: auto;
  }

  .turso-rag-fab:hover {
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 6px 20px rgba(79, 70, 229, 0.5);
  }

  .turso-rag-fab:active {
    transform: translateY(0) scale(0.95);
  }

  .turso-rag-fab svg {
    width: 24px;
    height: 24px;
    color: white;
  }

  /* Non-Modal Dialog */
  .turso-rag-dialog {
    position: fixed;
    bottom: 140px;
    right: 20px;
    width: 600px;
    max-width: calc(100vw - 40px);
    max-height: 70vh;
    background: var(--background);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    z-index: 49;
    overflow: hidden;
    border: 1px solid var(--border);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    color: var(--foreground);
  }

  @media (max-width: 768px) {
    .turso-rag-dialog {
      width: calc(100vw - 32px);
      right: 16px;
      left: 16px;
      bottom: 100px;
      /* Ensure dark mode background on mobile */
      background: var(--background);
      color: var(--foreground);
    }

    /* Dark mode mobile specific styles */
    .dark .turso-rag-dialog {
      background: var(--background);
      border-color: var(--border);
    }
  }

  .turso-rag-dialog.hidden {
    display: none;
  }

  /* Dialog Header */
  .turso-rag-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: white;
    flex-shrink: 0;
    cursor: grab;
    user-select: none;
    border-radius: 12px 12px 0 0;
  }

  .turso-rag-header:active {
    cursor: grabbing;
  }

  .turso-rag-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .turso-rag-close {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .turso-rag-close:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  /* Tab Navigation */
  .turso-rag-tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    background: var(--muted);
    flex-shrink: 0;
  }

  .turso-rag-tab {
    flex: 1;
    padding: 12px 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--muted-foreground);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .turso-rag-tab:hover {
    color: var(--foreground);
    background: rgba(79, 70, 229, 0.05);
  }

  .turso-rag-tab.active {
    color: #4f46e5;
    border-bottom: 2px solid #4f46e5;
    background: var(--background);
  }

  /* Tab Content - Flex container for panels */
  .turso-rag-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* Panel base */
  .turso-rag-panel {
    flex: 1;
    overflow: hidden;
    display: none;
    flex-direction: column;
    min-height: 0;
  }

  .turso-rag-panel.active {
    display: flex;
  }

  /* Documents Panel - Fixed toolbar, scrollable tree */
  .turso-rag-documents-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* Toolbar - Fixed at top */
  .turso-rag-toolbar {
    display: flex;
    gap: 8px;
    padding: 16px;
    padding-bottom: 12px;
    flex-wrap: wrap;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
    background: var(--background);
  }

  .turso-rag-btn {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--background);
    color: var(--foreground);
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  }

  .turso-rag-btn:hover {
    background: var(--muted);
    border-color: var(--border);
  }

  .turso-rag-btn.primary {
    background: #4f46e5;
    color: white;
    border-color: #4f46e5;
  }

  .turso-rag-btn.primary:hover {
    background: #4338ca;
  }

  .turso-rag-btn.danger {
    background: #ef4444;
    color: white;
    border-color: #ef4444;
  }

  .turso-rag-btn.danger:hover {
    background: #dc2626;
    border-color: #dc2626;
  }

  .turso-rag-warning-text {
    color: #dc2626;
    font-size: 0.9em;
    margin-top: 8px;
  }

  .turso-rag-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Document Tree - Scrollable area */
  .turso-rag-tree-scroll {
    flex: 1;
    overflow: auto;
    padding: 12px 16px;
    min-height: 0;
  }

  .turso-rag-tree {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  /* Folder Tree View */
  .turso-rag-folder-tree {
    font-family: monospace;
    font-size: 13px;
  }

  .turso-rag-folder {
    margin-left: 16px;
  }

  .turso-rag-folder:first-child {
    margin-left: 0;
  }

  .turso-rag-folder-name {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
    color: var(--foreground);
    cursor: pointer;
    user-select: none;
  }

  .turso-rag-folder-name:hover {
    color: #4f46e5;
  }

  .turso-rag-folder-content {
    display: none;
  }

  .turso-rag-folder.expanded > .turso-rag-folder-content {
    display: block;
  }

  .turso-rag-file {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0 4px 22px;
    color: var(--muted-foreground);
  }

  .turso-rag-file:hover {
    color: #4f46e5;
  }

  .turso-rag-file.adhoc {
    background: rgba(79, 70, 229, 0.05);
  }

  .turso-rag-file svg {
    color: var(--muted-foreground);
  }

  /* Chat Panel */
  .turso-rag-chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 400px;
  }

  .turso-rag-chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .turso-rag-message {
    max-width: 85%;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.5;
  }

  .turso-rag-message.user {
    align-self: flex-end;
    background: #4f46e5;
    color: white;
    border-bottom-right-radius: 4px;
  }

  .turso-rag-message.assistant {
    align-self: flex-start;
    background: var(--muted);
    color: var(--foreground);
    border: 1px solid var(--border);
    border-bottom-left-radius: 4px;
  }

  .turso-rag-message.system {
    align-self: center;
    background: rgba(79, 70, 229, 0.1);
    color: #4f46e5;
    font-size: 12px;
    padding: 8px 12px;
  }

  .turso-rag-message-content {
    display: block;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .turso-rag-message.user .turso-rag-message-content {
    color: white;
  }

  .turso-rag-message.assistant .turso-rag-message-content {
    color: var(--foreground);
  }

  .turso-rag-message-time {
    font-size: 11px;
    opacity: 0.7;
    margin-top: 4px;
  }

  /* Search Results in Chat */
  .turso-rag-results {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .turso-rag-results-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted-foreground);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Collapsible File Result Item */
  .turso-rag-result-file {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: 8px;
    overflow: hidden;
  }

  .turso-rag-result-file-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    cursor: pointer;
    background: var(--muted);
    transition: background 0.2s;
    user-select: none;
  }

  .turso-rag-result-file-header:hover {
    background: var(--border);
  }

  .turso-rag-result-file.expanded .turso-rag-result-file-header {
    background: rgba(79, 70, 229, 0.1);
  }

  .turso-rag-result-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: var(--muted-foreground);
    transition: transform 0.2s;
    flex-shrink: 0;
  }

  .turso-rag-result-file.expanded .turso-rag-result-toggle {
    transform: rotate(90deg);
  }

  .turso-rag-result-toggle svg {
    width: 16px;
    height: 16px;
  }

  .turso-rag-result-file-info {
    flex: 1;
    min-width: 0;
  }

  .turso-rag-result-file-name {
    font-weight: 600;
    font-size: 13px;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .turso-rag-result-file-path {
    font-size: 11px;
    color: var(--muted-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: monospace;
    margin-top: 2px;
  }

  .turso-rag-result-file-score {
    font-size: 11px;
    padding: 2px 6px;
    background: rgba(79, 70, 229, 0.1);
    color: #4f46e5;
    border-radius: 4px;
    font-variant-numeric: tabular-nums;
    font-weight: 500;
    flex-shrink: 0;
  }

  /* Expanded content area */
  .turso-rag-result-file-content {
    display: none;
    padding: 12px;
    background: var(--background);
    border-top: 1px solid var(--border);
    max-height: 300px;
    overflow-y: auto;
  }

  .turso-rag-result-file.expanded .turso-rag-result-file-content {
    display: block;
  }

  /* Individual chunks within a file */
  .turso-rag-result-chunk {
    margin-bottom: 12px;
    padding: 10px;
    background: var(--muted);
    border-radius: 4px;
    border-left: 3px solid #4f46e5;
  }

  .turso-rag-result-chunk:last-child {
    margin-bottom: 0;
  }

  .turso-rag-result-chunk-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted-foreground);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .turso-rag-result-chunk-text {
    font-size: 13px;
    color: var(--foreground);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Chat Input */
  .turso-rag-chat-input {
    display: flex;
    gap: 8px;
    padding: 16px;
    border-top: 1px solid var(--border);
    background: var(--background);
    flex-shrink: 0;
  }

  .turso-rag-chat-input input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    background: var(--background);
    color: var(--foreground);
  }

  .turso-rag-chat-input input:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  .turso-rag-chat-input button {
    padding: 10px 16px;
    background: #4f46e5;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: background 0.2s;
  }

  .turso-rag-chat-input button:hover {
    background: #4338ca;
  }

  .turso-rag-chat-input button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Status Bar */
  .turso-rag-status {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 16px;
    background: var(--muted);
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--muted-foreground);
    flex-shrink: 0;
  }

  .turso-rag-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
  }

  .turso-rag-status-dot.error {
    background: #ef4444;
  }

  .turso-rag-status-dot.loading {
    background: #f59e0b;
    animation: turso-rag-pulse 1.5s infinite;
  }

  @keyframes turso-rag-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Progress Bar */
  .turso-rag-progress-container {
    flex: 1;
    max-width: 200px;
    height: 6px;
    background: var(--border);
    border-radius: 3px;
    overflow: hidden;
  }

  .turso-rag-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%);
    border-radius: 3px;
    transition: width 0.3s ease;
    width: 0%;
  }

  .turso-rag-progress-text {
    font-size: 11px;
    min-width: 40px;
    text-align: right;
  }

  /* Floating Action Button Loading State */
  .turso-rag-fab.loading {
    background: linear-gradient(135deg, #4b5563 0%, #6b7280 100%);
    cursor: wait;
  }

  .turso-rag-fab.loading svg {
    animation: turso-rag-spin 1.5s linear infinite;
  }

  @keyframes turso-rag-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .turso-rag-fab-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 0 0 24px 24px;
    overflow: hidden;
  }

  .turso-rag-fab-progress-bar {
    height: 100%;
    background: #22c55e;
    transition: width 0.3s ease;
    width: 0%;
  }

  /* Modal for Add Document */
  .turso-rag-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .turso-rag-modal {
    background: var(--background);
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    color: var(--foreground);
  }

  .turso-rag-modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .turso-rag-modal-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--foreground);
  }

  .turso-rag-modal-body {
    padding: 20px;
    overflow-y: auto;
  }

  .turso-rag-form-group {
    margin-bottom: 16px;
  }

  .turso-rag-form-group label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--foreground);
    margin-bottom: 6px;
  }

  .turso-rag-form-group input,
  .turso-rag-form-group textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 14px;
    background: var(--background);
    color: var(--foreground);
    font-family: inherit;
  }

  .turso-rag-form-group textarea {
    min-height: 150px;
    resize: vertical;
    font-family: monospace;
    font-size: 13px;
  }

  .turso-rag-form-group input:focus,
  .turso-rag-form-group textarea:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  .turso-rag-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--border);
    background: var(--muted);
  }

  /* Empty State */
  .turso-rag-empty {
    text-align: center;
    padding: 40px 20px;
    color: var(--muted-foreground);
  }

  .turso-rag-empty svg {
    margin-bottom: 12px;
    color: var(--border);
  }

  .turso-rag-empty p {
    margin: 0;
    font-size: 14px;
  }

  /* Scrollbar styling */
  .turso-rag-dialog ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .turso-rag-dialog ::-webkit-scrollbar-track {
    background: transparent;
  }

  .turso-rag-dialog ::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 4px;
  }

  .turso-rag-dialog ::-webkit-scrollbar-thumb:hover {
    background: var(--muted-foreground);
  }

  /* Dark mode scrollbar overrides for the dialog */
  .dark .turso-rag-dialog ::-webkit-scrollbar-track {
    background: var(--muted);
  }

  .dark .turso-rag-dialog ::-webkit-scrollbar-thumb {
    background: var(--border);
  }

  .dark .turso-rag-dialog ::-webkit-scrollbar-thumb:hover {
    background: var(--muted-foreground);
  }
`;

/**
 * Inject styles into the document
 * @public
 */
export function injectStyles(): void {
  if (document.getElementById('turso-rag-styles')) return;

  const style = document.createElement('style');
  style.id = 'turso-rag-styles';
  style.textContent = DEBUG_STYLES;
  document.head.appendChild(style);
}

/**
 * Remove styles from the document
 * @public
 */
export function removeStyles(): void {
  const style = document.getElementById('turso-rag-styles');
  if (style) {
    style.remove();
  }
}
