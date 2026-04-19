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
 * import { initializeTursoRagDebug } from './turso-rag-debug';
 *
 * // Initialize on app mount
 * useEffect(() => {
 *   initializeTursoRagDebug();
 * }, []);
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

// Re-export main initialization function
export {
  initializeTursoRagDebug,
  setDebugEnabled,
  openDialog,
  closeDialog,
  toggleDialog,
  switchTab,
  updateStatus,
  openChatWithQuery,
} from './ui';

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
} from './chat';

// Re-export Turso RAG instance
export {
  tursoRAG,
  getInitializationState,
  subscribeToInitializationState,
} from './turso-rag';

// Re-export state (for advanced usage)
export { state, debugDialog, floatingButton } from './state';
