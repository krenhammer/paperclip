/**
 * @module turso-rag-debug/react
 *
 * React components for the Turso Browser RAG debug tool.
 *
 * Provides a modern React-based interface for debugging and managing the RAG system:
 * - RAGDebugTool: Main orchestrator component
 * - RAGDebugFAB: Floating action button
 * - RAGDebugDialog: Draggable dialog with tabs
 * - DocumentsPanel: Folder tree view
 * - ChatPanel: Interactive RAG query testing
 * - StatusBar: Status indicator and progress
 * - ReusableSpinner: Loading spinner component
 *
 * @packageDocumentation
 */

// Main component
export { RAGDebugTool, type RAGDebugToolProps } from './RAGDebugTool';

// Dialog and FAB
export { RAGDebugDialog, type RAGDebugDialogProps } from './RAGDebugDialog';
export { RAGDebugFAB, type RAGDebugFABProps } from './RAGDebugFAB';

// Panels
export { DocumentsPanel, type DocumentsPanelProps } from './DocumentsPanel';
export { ChatPanel, type ChatPanelProps } from './ChatPanel';

// UI components
export { StatusBar, type StatusBarProps } from './StatusBar';
export { ReusableSpinner, type SpinnerProps as ReusableSpinnerProps } from './ReusableSpinner';
