/**
 * @module turso-rag-debug/react/RAGDebugTool
 *
 * Main orchestrator component for the RAG debug tool.
 *
 * Combines FAB, Dialog, DocumentsPanel, ChatPanel, and StatusBar
 * into a unified React interface.
 *
 * Manages:
 * - Dialog open/close state
 * - Active tab state
 * - RAG initialization and state subscriptions
 * - Business logic integration via existing modules
 *
 * @packageDocumentation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// Components
import { RAGDebugFAB } from './RAGDebugFAB';
import { RAGDebugDialog } from './RAGDebugDialog';
import { DocumentsPanel } from './DocumentsPanel';
import { ChatPanel } from './ChatPanel';

// Types
import type { DebugDocument, ChatMessage, InitializationProgress } from '../types';

import {
  getPrebuiltRAG,
  markAutoInitStarted,
  autoInitStarted,
  subscribeToChatMessages
} from '../state';
import {
  refreshDocuments,
  showAddDocumentModal,
  showClearDatabaseConfirmModal,
  getIndexedDocuments
} from '../documents';
import { sendChatMessageReact, warmUpRAG } from '../chat';
import { checkDebugEnabled } from '../utils';

/**
 * Status type for the status bar
 */
type StatusType = 'loading' | 'error' | 'ready';

/**
 * Interface for initialization state from turso-rag
 */
interface TursoInitializationState {
  isInitializing: boolean;
  progress: number;
  message: string;
  error: string | null;
  stage: string;
}

/**
 * Props for RAGDebugTool component
 * @public
 */
export interface RAGDebugToolProps {
  /** Control dialog open state externally */
  isOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Whether to show the floating action button (default: true) */
  showFAB?: boolean;
}

/**
 * Main RAG Debug Tool component
 * 
 * This is the root component that orchestrates all RAG debug functionality:
 * - Floating action button (FAB) (optional)
 * - Draggable dialog with tabs
 * - Documents panel with folder tree
 * - Chat panel with search results
 * - Status bar with progress
 * 
 * Integrates with existing vanilla JS modules via callbacks and state bridging.
 * 
 * @example
 * ```tsx
 * // With external control (no FAB)
 * <RAGDebugTool isOpen={isOpen} onOpenChange={setIsOpen} showFAB={false} />
 * 
 * // Standalone with FAB
 * <RAGDebugTool />
 * ```
 * 
 * @public
 */
export function RAGDebugTool({ 
  isOpen: controlledIsOpen, 
  onOpenChange,
  showFAB = true 
}: RAGDebugToolProps): React.ReactElement | null {
  // Check if debug mode is enabled
  const isDebugEnabled = checkDebugEnabled();
  if (!isDebugEnabled) {
    console.log('[RAGDebug] Debug mode not enabled. Set VITE_TURSO_RAG_DEBUG=true to enable.');
    return null;
  }

  // State - support both controlled and uncontrolled modes
  const isControlled = controlledIsOpen !== undefined;
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const isOpen = isControlled ? controlledIsOpen : uncontrolledIsOpen;
  
  const setIsOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const newValue = typeof value === 'function' ? value(isOpen) : value;
    if (!isControlled) {
      setUncontrolledIsOpen(newValue);
    }
    onOpenChange?.(newValue);
  }, [isControlled, isOpen, onOpenChange]);

  const [activeTab, setActiveTab] = useState<'documents' | 'chat'>('documents');
  const [documents, setDocuments] = useState<DebugDocument[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'system',
      content: 'Welcome to RAG Debug Chat! Type a query to test semantic search against the documentation.',
      timestamp: Date.now(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [statusType, setStatusType] = useState<StatusType>('loading');
  const [chunkCount, setChunkCount] = useState<number | undefined>(undefined);

  // Ref for tracking initialization
  const isInitialized = useRef(false);

  /**
   * Initialize RAG on mount
   */
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const initializeRAG = async () => {
      console.log('[RAGDebug] Initializing RAG...');
      setStatusType('loading');
      setStatusMessage('Loading Turso Browser RAG...');
      setProgress(5);

      try {
        const { tursoRAG } = await getPrebuiltRAG();

        // Subscribe to initialization state changes
        import('../turso-rag').then((mod) => {
          mod.subscribeToInitializationState((initState: TursoInitializationState) => {
            setProgress(initState.progress);
            setStatusMessage(initState.message || 'Loading...');

            if (initState.error) {
              setStatusType('error');
              setStatusMessage(`Error: ${initState.error}`);
            } else if (initState.isInitializing) {
              setStatusType('loading');
            }
          });
        });

        // Check if RAG is ready
        if (!tursoRAG.isReady()) {
          // Initialize RAG with progress updates
          setProgress(10);
          setStatusMessage('Initializing Turso Browser RAG...');

          await tursoRAG.initialize((progressCallback: InitializationProgress) => {
            setProgress(progressCallback.progress);
            setStatusMessage(progressCallback.message || 'Loading...');
          });
        }

        setStatusMessage('Warming up model...');
        await warmUpRAG();

        setProgress(100);
        setStatusType('ready');
        setStatusMessage('Turso Browser RAG Ready');

        // Get index size
        const size = await tursoRAG.getIndexSize();
        setChunkCount(size);

        // Load documents
        setIsLoading(false);
        const docs = await getIndexedDocuments();
        setDocuments(docs);

        console.log('[RAGDebug] RAG initialized successfully');
      } catch (error) {
        console.error('[RAGDebug] RAG initialization failed:', error);
        setStatusType('error');
        setStatusMessage(`Error: ${error instanceof Error ? error.message : 'Initialization failed'}`);
        setIsLoading(false);
      }
    };

    // Auto-initialize RAG on page load (non-blocking)
    if (!autoInitStarted) {
      markAutoInitStarted();
      initializeRAG();
    }

    return () => {
      // Cleanup if needed
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToChatMessages((messages) => {
      setChatMessages(messages);
    });
    
    return unsubscribe;
  }, []);

  /**
   * Handle FAB click
   */
  const handleFABClick = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  /**
   * Handle dialog close
   */
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    
    if (open) {
      // Refresh data when opening
      refreshDocuments().then((docs) => {
        setDocuments(docs);
      });
    }
  }, []);

  /**
   * Handle tab change
   */
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as 'documents' | 'chat');
  }, []);

  /**
   * Handle refresh documents
   */
  const handleRefreshDocuments = useCallback(async () => {
    setIsLoading(true);
    setStatusType('loading');
    setStatusMessage('Loading documents...');

    try {
      const docs = await refreshDocuments();
      setDocuments(docs);
      
      const size = docs.reduce((acc, doc) => acc + doc.chunkCount, 0);
      setChunkCount(size);
      
      setStatusType('ready');
      setStatusMessage(`Loaded ${docs.length} documents`);
    } catch (error) {
      setStatusType('error');
      setStatusMessage(`Error: ${error instanceof Error ? error.message : 'Failed to load'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Handle add document
   */
  const handleAddDocument = useCallback(() => {
    showAddDocumentModal();
  }, []);

  /**
   * Handle clear database
   */
  const handleClearDatabase = useCallback(() => {
    showClearDatabaseConfirmModal();
  }, []);

  const handleSendMessage = useCallback(async (message: string) => {
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, userMessage]);

    const loadingMessage: ChatMessage = {
      role: 'system',
      content: 'Loading Turso Browser RAG and searching...',
      timestamp: Date.now() + 1,
    };
    setChatMessages((prev) => [...prev, loadingMessage]);

    try {
      const response = await sendChatMessageReact(message);
      setChatMessages((prev) => {
        const withoutLoading = prev.filter((m) => m !== loadingMessage);
        return [...withoutLoading, response];
      });
    } catch (error) {
      setChatMessages((prev) => [
        ...prev.filter((m) => m !== loadingMessage),
        {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Search failed'}`,
          timestamp: Date.now(),
        },
      ]);
    }
  }, []);

  /**
   * Check if FAB should be disabled
   */
  const isFABDisabled = statusType === 'error' || (statusType === 'loading' && progress < 100);

  return (
    <>
      {/* Inject styles */}
      <style>{`
        @keyframes rag-debug-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes rag-debug-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* RAG debug: self-contained hex palette only (no app CSS variables — Radix portal). */

        /* FAB Styles */
        .rag-debug-fab {
          position: fixed;
          bottom: 20px;
          right: 20px;
          left: auto;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
          transition: all 0.3s ease;
          z-index: 9998;
        }

        .rag-debug-fab:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
        }

        .rag-debug-fab:active:not(:disabled) {
          transform: scale(0.95);
        }

        .rag-debug-fab:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .rag-debug-fab svg {
          width: 24px;
          height: 24px;
          color: white;
        }

        .rag-debug-fab.loading {
          cursor: wait;
        }

        /* Dialog — position (bottom/right) set inline; default anchors lower-right */
        .rag-debug-dialog {
          position: fixed;
          width: min(600px, calc(100vw - 40px));
          min-height: min(600px, calc(100dvh - 48px));
          max-height: min(85dvh, calc(100dvh - 24px));
          background-color: #fafafa !important;
          color: #18181b;
          border-radius: 12px;
          box-shadow:
            0 0 0 1px rgba(228, 228, 231, 0.95),
            0 20px 50px rgba(0, 0, 0, 0.45);
          display: flex;
          flex-direction: column;
          z-index: 9997;
          overflow: hidden;
          border: 1px solid #e4e4e7;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px;
        }

        html.dark .rag-debug-dialog,
        .dark .rag-debug-dialog {
          background-color: #27272a !important;
          color: #fafafa;
          box-shadow:
            0 0 0 1px rgba(63, 63, 70, 0.85),
            0 24px 56px rgba(0, 0, 0, 0.55);
          border-color: #3f3f46;
        }

        .rag-debug-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
          color: white;
          flex-shrink: 0;
          cursor: grab;
          user-select: none;
        }

        .rag-debug-header:active {
          cursor: grabbing;
        }

        .rag-debug-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rag-debug-close {
          background: transparent !important;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .rag-debug-close:hover {
          background: rgba(255, 255, 255, 0.2) !important;
        }

        /* Tabs */
        .rag-debug-tabs {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }

        .rag-debug-tabs-list {
          display: flex;
          border-bottom: 1px solid #e4e4e7;
          background: #e4e4e7 !important;
        }

        html.dark .rag-debug-tabs-list,
        .dark .rag-debug-tabs-list {
          border-bottom-color: #3f3f46;
          background: #3f3f46 !important;
        }

        .rag-debug-tab-trigger {
          flex: 1;
          padding: 12px 16px;
          border: none;
          background: transparent !important;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #71717a;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
        }

        html.dark .rag-debug-tab-trigger,
        .dark .rag-debug-tab-trigger {
          color: #a1a1aa;
        }

        .rag-debug-tab-trigger:hover {
          background: #f4f4f5 !important;
          color: #18181b;
        }

        html.dark .rag-debug-tab-trigger:hover,
        .dark .rag-debug-tab-trigger:hover {
          background: #52525b !important;
          color: #fafafa;
        }

        .rag-debug-tab-trigger[data-state="active"] {
          color: #2563eb;
          border-bottom-color: #2563eb;
          background: #f4f4f5 !important;
        }

        html.dark .rag-debug-tab-trigger[data-state="active"],
        .dark .rag-debug-tab-trigger[data-state="active"] {
          color: #60a5fa;
          border-bottom-color: #60a5fa;
          background: #18181b !important;
        }

        .rag-debug-tab-content {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          background-color: #f4f4f5 !important;
        }

        html.dark .rag-debug-tab-content,
        .dark .rag-debug-tab-content {
          background-color: #18181b !important;
        }

        /* Status Bar */
        .rag-debug-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #e4e4e7 !important;
          border-top: 1px solid #e4e4e7;
          color: #71717a;
          font-size: 12px;
          font-family: system-ui, -apple-system, sans-serif;
          flex-shrink: 0;
        }

        html.dark .rag-debug-status,
        .dark .rag-debug-status {
          background: #27272a !important;
          border-top-color: #3f3f46;
          color: #a1a1aa;
        }

        .rag-debug-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e !important;
          flex-shrink: 0;
        }

        .rag-debug-status-dot.loading {
          background: #f59e0b !important;
          animation: rag-debug-pulse 1.5s ease-in-out infinite;
        }

        .rag-debug-status-dot.error {
          background: #ef4444 !important;
        }

        /* Progress */
        .rag-debug-progress-container {
          flex: 1;
          height: 4px;
          background: #d4d4d8 !important;
          border-radius: 2px;
          overflow: hidden;
        }

        html.dark .rag-debug-progress-container,
        .dark .rag-debug-progress-container {
          background: #52525b !important;
        }

        .rag-debug-progress-root {
          background-color: #d4d4d8 !important;
        }

        html.dark .rag-debug-progress-root,
        .dark .rag-debug-progress-root {
          background-color: #52525b !important;
        }

        .rag-debug-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%) !important;
          transition: width 0.3s ease;
        }

        .rag-debug-progress-text {
          font-size: 11px;
          color: #71717a;
          min-width: 35px;
        }

        html.dark .rag-debug-progress-text,
        .dark .rag-debug-progress-text {
          color: #a1a1aa;
        }

        /* Documents Panel Styles */
        .rag-debug-documents-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: #f4f4f5 !important;
        }

        html.dark .rag-debug-documents-container,
        .dark .rag-debug-documents-container {
          background-color: #18181b !important;
        }

        .rag-debug-toolbar {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid #e4e4e7;
          background: #e4e4e7 !important;
          flex-shrink: 0;
        }

        html.dark .rag-debug-toolbar,
        .dark .rag-debug-toolbar {
          border-bottom-color: #3f3f46;
          background: #3f3f46 !important;
        }

        .rag-debug-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid #e4e4e7;
          background: #e4e4e7 !important;
          color: #18181b;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        html.dark .rag-debug-btn,
        .dark .rag-debug-btn {
          border-color: #52525b;
          background: #3f3f46 !important;
          color: #fafafa;
        }

        .rag-debug-btn:hover:not(:disabled) {
          background: #f4f4f5 !important;
          color: #18181b;
        }

        html.dark .rag-debug-btn:hover:not(:disabled),
        .dark .rag-debug-btn:hover:not(:disabled) {
          background: #52525b !important;
          color: #fafafa;
        }

        .rag-debug-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .rag-debug-btn.primary {
          background: #2563eb !important;
          color: #ffffff;
          border-color: #2563eb;
        }

        .rag-debug-btn.primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .rag-debug-btn.danger {
          background: #dc2626 !important;
          color: white;
          border-color: #dc2626;
        }

        .rag-debug-btn.danger:hover:not(:disabled) {
          opacity: 0.9;
        }

        .rag-debug-tree-scroll {
          flex: 1;
          overflow: auto;
          padding: 16px;
        }

        .rag-debug-folder-tree {
          font-size: 13px;
        }

        .rag-debug-folder {
          margin: 2px 0;
        }

        .rag-debug-folder-name {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          border-radius: 6px;
          cursor: pointer;
          color: #71717a;
          font-weight: 500;
          user-select: none;
          transition: all 0.15s;
        }

        html.dark .rag-debug-folder-name,
        .dark .rag-debug-folder-name {
          color: #a1a1aa;
        }

        .rag-debug-folder-name:hover {
          background: #f4f4f5;
          color: #18181b;
        }

        html.dark .rag-debug-folder-name:hover,
        .dark .rag-debug-folder-name:hover {
          background: #3f3f46;
          color: #fafafa;
        }

        .rag-debug-folder-content {
          margin-left: 20px;
          border-left: 1px solid #e4e4e7;
          padding-left: 8px;
        }

        html.dark .rag-debug-folder-content,
        .dark .rag-debug-folder-content {
          border-left-color: #3f3f46;
        }

        .rag-debug-file {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 4px;
          color: #18181b;
          font-size: 12px;
          cursor: default;
        }

        html.dark .rag-debug-file,
        .dark .rag-debug-file {
          color: #fafafa;
        }

        .rag-debug-file:hover {
          background: #f4f4f5;
        }

        html.dark .rag-debug-file:hover,
        .dark .rag-debug-file:hover {
          background: #3f3f46;
        }

        .rag-debug-file.adhoc {
          color: #2563eb;
        }

        html.dark .rag-debug-file.adhoc,
        .dark .rag-debug-file.adhoc {
          color: #60a5fa;
        }

        .rag-debug-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px 20px;
          color: #71717a;
          text-align: center;
        }

        html.dark .rag-debug-empty,
        .dark .rag-debug-empty {
          color: #a1a1aa;
        }

        .rag-debug-empty svg {
          opacity: 0.5;
        }

        /* Chat Panel Styles */
        .rag-debug-chat {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: #f4f4f5 !important;
        }

        html.dark .rag-debug-chat,
        .dark .rag-debug-chat {
          background-color: #18181b !important;
        }

        .rag-debug-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rag-debug-message {
          max-width: 85%;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.5;
        }

        .rag-debug-message.user {
          align-self: flex-end;
          background: #2563eb !important;
          color: #ffffff;
          border-bottom-right-radius: 4px;
        }

        .rag-debug-message.assistant {
          align-self: flex-start;
          background: #e4e4e7 !important;
          color: #18181b;
          border-bottom-left-radius: 4px;
        }

        html.dark .rag-debug-message.assistant,
        .dark .rag-debug-message.assistant {
          background: #3f3f46 !important;
          color: #fafafa;
        }

        .rag-debug-message.system {
          align-self: center;
          background: transparent !important;
          color: #71717a;
          font-size: 12px;
          font-style: italic;
          padding: 4px 8px;
        }

        html.dark .rag-debug-message.system,
        .dark .rag-debug-message.system {
          color: #a1a1aa;
        }

        .rag-debug-message-time {
          font-size: 10px;
          opacity: 0.6;
          margin-top: 4px;
        }

        .rag-debug-chat-input {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid #e4e4e7;
          background: #e4e4e7 !important;
        }

        html.dark .rag-debug-chat-input,
        .dark .rag-debug-chat-input {
          border-top-color: #3f3f46;
          background: #27272a !important;
        }

        .rag-debug-chat-input input {
          flex: 1;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #e4e4e7;
          background: #ffffff !important;
          color: #18181b;
          font-size: 13px;
          outline: none;
        }

        html.dark .rag-debug-chat-input input,
        .dark .rag-debug-chat-input input {
          border-color: #52525b;
          background: #18181b !important;
          color: #fafafa;
        }

        .rag-debug-chat-input input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
        }

        html.dark .rag-debug-chat-input input:focus,
        .dark .rag-debug-chat-input input:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.35);
        }

        .rag-debug-chat-input input::placeholder {
          color: #71717a;
        }

        html.dark .rag-debug-chat-input input::placeholder,
        .dark .rag-debug-chat-input input::placeholder {
          color: #a1a1aa;
        }

        .rag-debug-chat-input button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 6px;
          border: none;
          background: #2563eb !important;
          color: #ffffff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .rag-debug-chat-input button:hover:not(:disabled) {
          opacity: 0.9;
        }

        .rag-debug-chat-input button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Search Results Styles */
        .rag-debug-results {
          margin-top: 12px;
          border: 1px solid #e4e4e7;
          border-radius: 8px;
          overflow: hidden;
          background: #e4e4e7 !important;
        }

        html.dark .rag-debug-results,
        .dark .rag-debug-results {
          border-color: #3f3f46;
          background: #3f3f46 !important;
        }

        .rag-debug-results-title {
          padding: 8px 12px;
          background: #e4e4e7 !important;
          border-bottom: 1px solid #e4e4e7;
          font-size: 11px;
          font-weight: 600;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        html.dark .rag-debug-results-title,
        .dark .rag-debug-results-title {
          background: #3f3f46 !important;
          border-bottom-color: #52525b;
          color: #a1a1aa;
        }

        .rag-debug-result-file {
          border-bottom: 1px solid #e4e4e7;
        }

        html.dark .rag-debug-result-file,
        .dark .rag-debug-result-file {
          border-bottom-color: #3f3f46;
        }

        .rag-debug-result-file:last-child {
          border-bottom: none;
        }

        .rag-debug-result-file-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .rag-debug-result-file-header:hover {
          background: #f4f4f5;
        }

        html.dark .rag-debug-result-file-header:hover,
        .dark .rag-debug-result-file-header:hover {
          background: #52525b;
        }

        .rag-debug-result-toggle {
          transition: transform 0.2s;
          color: #71717a;
        }

        html.dark .rag-debug-result-toggle,
        .dark .rag-debug-result-toggle {
          color: #a1a1aa;
        }

        .rag-debug-result-file.expanded .rag-debug-result-toggle {
          transform: rotate(90deg);
        }

        .rag-debug-result-file-info {
          flex: 1;
          min-width: 0;
        }

        .rag-debug-result-file-name {
          font-weight: 500;
          font-size: 13px;
          color: #18181b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        html.dark .rag-debug-result-file-name,
        .dark .rag-debug-result-file-name {
          color: #fafafa;
        }

        .rag-debug-result-file-path {
          font-size: 11px;
          color: #71717a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        html.dark .rag-debug-result-file-path,
        .dark .rag-debug-result-file-path {
          color: #a1a1aa;
        }

        .rag-debug-result-file-score {
          font-size: 11px;
          font-weight: 600;
          color: #2563eb;
          padding: 2px 6px;
          background: #f4f4f5 !important;
          border-radius: 4px;
        }

        html.dark .rag-debug-result-file-score,
        .dark .rag-debug-result-file-score {
          color: #60a5fa;
          background: #18181b !important;
        }

        .rag-debug-result-file-content {
          display: none;
          border-top: 1px solid #e4e4e7;
          background: #f4f4f5 !important;
        }

        html.dark .rag-debug-result-file-content,
        .dark .rag-debug-result-file-content {
          border-top-color: #3f3f46;
          background: #18181b !important;
        }

        .rag-debug-result-file.expanded .rag-debug-result-file-content {
          display: block;
        }

        .rag-debug-result-chunk {
          padding: 10px 12px;
          border-bottom: 1px solid #e4e4e7;
        }

        html.dark .rag-debug-result-chunk,
        .dark .rag-debug-result-chunk {
          border-bottom-color: #3f3f46;
        }

        .rag-debug-result-chunk:last-child {
          border-bottom: none;
        }

        .rag-debug-result-chunk-header {
          font-size: 11px;
          font-weight: 500;
          color: #71717a;
          margin-bottom: 6px;
        }

        html.dark .rag-debug-result-chunk-header,
        .dark .rag-debug-result-chunk-header {
          color: #a1a1aa;
        }

        .rag-debug-result-chunk-text {
          font-size: 12px;
          color: #18181b;
          line-height: 1.5;
        }

        html.dark .rag-debug-result-chunk-text,
        .dark .rag-debug-result-chunk-text {
          color: #fafafa;
        }

        /* StatusBar additional styles */
        .rag-debug-index-size {
          font-size: 11px;
          color: #71717a;
          margin-left: 8px;
        }

        html.dark .rag-debug-index-size,
        .dark .rag-debug-index-size {
          color: #a1a1aa;
        }
      `}</style>

      {/* Floating Action Button - only shown when showFAB is true */}
      {showFAB && (
        <RAGDebugFAB
          isLoading={statusType === 'loading'}
          progress={progress}
          disabled={isFABDisabled}
          onClick={handleFABClick}
        />
      )}

      <RAGDebugDialog
        open={isOpen}
        onOpenChange={handleOpenChange}
        statusMessage={statusMessage}
        statusType={statusType}
        progress={progress}
        chunkCount={chunkCount}
      >
        {{
          documentsPanel: (
            <DocumentsPanel
              documents={documents}
              onRefresh={handleRefreshDocuments}
              onAddDocument={handleAddDocument}
              onClearDatabase={handleClearDatabase}
              isLoading={isLoading}
            />
          ),
          chatPanel: (
            <ChatPanel
              messages={chatMessages}
              onSendMessage={handleSendMessage}
            />
          ),
        }}
      </RAGDebugDialog>
    </>
  );
}

export default RAGDebugTool;
