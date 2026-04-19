/**
 * @module turso-rag-debug
 *
 * Turso Browser RAG Debug Tool for Paperclip
 *
 * Provides a development interface for debugging and managing the RAG system:
 * - Floating action button with Turso database icon (right sidebar, below Vowel)
 * - Non-modal dialog with tabbed interface
 * - Documents tab: view folder structure, add/remove adhoc docs, import/export, clear/reload
 * - Chat tab: interactive RAG query testing with results
 *
 * Only enabled when VITE_TURSO_RAG_DEBUG=true in environment, or when
 * localStorage.setItem('paperclip-turso-rag-debug-force', 'true') is set.
 *
 * @example
 * ```typescript
 * import { RAGDebugTool } from './turso-rag-debug/react';
 *
 * // Use in your React component
 * <RAGDebugTool />
 * ```
 *
 * @packageDocumentation
 */

// Re-export types
export type {
  PrebuiltChunk,
  PrebuiltIndex,
  DocumentEntry,
  DocumentsManifest,
  SearchResult,
  DebugDocument,
  ChatRole,
  ChatMessage,
  DebugState,
  FolderNode,
  AdhocDocument,
  InitializationProgress,
  TursoRAG,
} from './types';

// Re-export React components
export {
  RAGDebugTool,
  RAGDebugDialog,
  RAGDebugFAB,
  DocumentsPanel,
  ChatPanel,
  StatusBar,
  ReusableSpinner,
  type RAGDebugDialogProps,
  type RAGDebugFABProps,
  type DocumentsPanelProps,
  type ChatPanelProps,
  type StatusBarProps,
  type ReusableSpinnerProps,
} from './react';

// Re-export utility functions
export {
  checkDebugEnabled,
  getAdhocDocuments,
  saveAdhocDocuments,
  ADHOC_DOCS_KEY,
  escapeHtml,
  formatTime,
} from './utils';

// Re-export document management
export {
  refreshDocuments,
  getIndexedDocuments,
  addAdhocDocument,
  removeAdhocDocument,
  showClearDatabaseConfirmModal,
  clearDatabase,
  reloadDocuments,
  showAddDocumentModal,
} from './documents';

// Re-export chat functions
export {
  addChatMessage,
  sendChatMessage,
  sendChatMessageReact,
  warmUpRAG,
} from './chat';

// Re-export Turso RAG instance
export {
  tursoRAG,
  getInitializationState,
  subscribeToInitializationState,
} from './turso-rag';

// Re-export state
export {
  state,
  debugDialog,
  floatingButton,
  subscribeToChatMessages,
  getPrebuiltRAG,
  markAutoInitStarted,
  autoInitStarted,
} from './state';
