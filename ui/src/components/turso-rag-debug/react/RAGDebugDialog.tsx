/**
 * @module turso-rag-debug/react/RAGDebugDialog
 *
 * Draggable dialog component for the RAG debug tool.
 *
 * Provides a floating dialog with tabs for switching between
 * Documents and Chat panels.
 *
 * @packageDocumentation
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { StatusBar } from './StatusBar';

/**
 * Props for the RAGDebugDialog component
 *
 * @public
 */
export interface RAGDebugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active tab (controlled) */
  activeTab: 'documents' | 'chat';
  /** Tab change from user interaction */
  onActiveTabChange: (tab: 'documents' | 'chat') => void;
  children: {
    documentsPanel: React.ReactNode;
    chatPanel: React.ReactNode;
  };
  statusMessage: string;
  statusType: 'loading' | 'error' | 'ready';
  progress?: number;
  chunkCount?: number;
}

/**
 * Draggable dialog component for the RAG debug tool.
 *
 * Features:
 * - Radix Dialog with `modal={false}` so the rest of the app stays clickable (debug HUD)
 * - Radix Tabs primitive for Documents/Chat switching
 * - Draggable header for repositioning
 * - Fixed positioning at bottom-right of viewport (draggable)
 *
 * @example
 * ```tsx
 * <RAGDebugDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   children={{
 *     documentsPanel: <DocumentsPanel />,
 *     chatPanel: <ChatPanel />,
 *   }}
 * />
 * ```
 *
 * @public
 */
export function RAGDebugDialog({
  open,
  onOpenChange,
  activeTab,
  onActiveTabChange,
  children,
  statusMessage,
  statusType,
  progress,
  chunkCount,
}: RAGDebugDialogProps): React.ReactElement {
  /** Distance from viewport right and bottom edges (fixed positioning). */
  const [position, setPosition] = useState({ bottom: 24, right: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dialogRef.current) return;

      const rect = dialogRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dialogRef.current) return;

      const el = dialogRef.current;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      const newLeft = e.clientX - dragOffset.x;
      const newTop = e.clientY - dragOffset.y;

      const minLeft = 20;
      const maxLeft = window.innerWidth - width - 20;
      const clampedLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
      const right = window.innerWidth - clampedLeft - width;

      const minTop = 20;
      const maxTop = window.innerHeight - height - 20;
      const clampedTop = Math.max(minTop, Math.min(newTop, maxTop));
      const bottom = window.innerHeight - clampedTop - height;

      setPosition({ right, bottom });
    },
    [isDragging, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          ref={dialogRef}
          className="rag-debug-dialog"
          style={{
            bottom: position.bottom,
            right: position.right,
            left: 'auto',
            top: 'auto',
          }}
          onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
          onEscapeKeyDown={(e: Event) => e.preventDefault()}
        >
          {/* Header - Draggable */}
          <div
            className="rag-debug-header"
            onMouseDown={handleMouseDown}
          >
            <Dialog.Title className="rag-debug-title">Turso Browser RAG</Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rag-debug-close"
                aria-label="Close"
                type="button"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 4L4 12M4 4L12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          <Tabs.Root
            value={activeTab}
            onValueChange={(v) => onActiveTabChange(v as 'documents' | 'chat')}
            className="rag-debug-tabs"
          >
            <Tabs.List className="rag-debug-tabs-list" aria-label="RAG Debug Tools">
              <Tabs.Trigger
                value="documents"
                className="rag-debug-tab-trigger"
              >
                Documents
              </Tabs.Trigger>
              <Tabs.Trigger
                value="chat"
                className="rag-debug-tab-trigger"
              >
                Chat
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content
              value="documents"
              className="rag-debug-tab-content"
            >
              {children.documentsPanel}
            </Tabs.Content>

            <Tabs.Content
              value="chat"
              className="rag-debug-tab-content"
            >
              {children.chatPanel}
            </Tabs.Content>
          </Tabs.Root>

          <StatusBar
            message={statusMessage}
            type={statusType}
            progress={progress}
            chunkCount={chunkCount}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default RAGDebugDialog;
