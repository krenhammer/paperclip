/**
 * @module turso-rag-debug/react/DocumentsPanel
 *
 * Document tree panel with toolbar and folder tree view for the RAG debug tool.
 *
 * Features:
 * - Fixed toolbar with Add Document, Clear DB, and Refresh buttons
 * - Collapsible folder tree view
 * - Adhoc document labeling
 * - Empty state with database icon
 * - Loading state support
 *
 * @packageDocumentation
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { DebugDocument, FolderNode } from '../types';
import { ICONS } from '../icons';

/**
 * Props for the DocumentsPanel component
 *
 * @public
 */
export interface DocumentsPanelProps {
  /** List of documents to display */
  documents: DebugDocument[];
  /** Callback for refresh button */
  onRefresh: () => void;
  /** Callback for add document button */
  onAddDocument: () => void;
  /** Callback for clear database button */
  onClearDatabase: () => void;
  /** Whether documents are currently loading */
  isLoading: boolean;
}

/**
 * Build a folder tree structure from flat document list
 *
 * @param docs - Flat array of documents
 * @returns Root folder node
 * @internal
 */
function buildFolderTree(docs: DebugDocument[]): FolderNode {
  const root: FolderNode = { name: 'root', path: '', children: new Map(), files: [] };

  for (const doc of docs) {
    // Parse path like '../../content/docs/guides/index.mdx'
    const parts = doc.path.split('/').filter(p => p && p !== '..' && p !== 'src' && p !== 'content' && p !== 'docs');

    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: [...parts.slice(0, i + 1)].join('/'),
          children: new Map(),
          files: [],
        });
      }
      current = current.children.get(part)!;
    }

    current.files.push(doc);
  }

  return root;
}

/**
 * Props for the FolderTreeItem component
 *
 * @internal
 */
interface FolderTreeItemProps {
  /** Folder node to render */
  node: FolderNode;
  /** Current nesting level */
  level?: number;
  /** Set of expanded folder paths */
  expandedFolders: Set<string>;
  /** Toggle folder expansion */
  onToggleFolder: (path: string) => void;
}

/**
 * Individual folder item in the tree
 *
 * @internal
 */
function FolderTreeItem({
  node,
  level = 0,
  expandedFolders,
  onToggleFolder,
}: FolderTreeItemProps): React.ReactElement | null {
  if (level === 0) {
    // Root level - render children only
    const children = Array.from(node.children.values());
    return (
      <div className="rag-debug-folder-tree">
        {children.map(child => (
          <FolderTreeItem
            key={child.path}
            node={child}
            level={level + 1}
            expandedFolders={expandedFolders}
            onToggleFolder={onToggleFolder}
          />
        ))}
      </div>
    );
  }

  const hasChildren = node.children.size > 0;
  const isExpanded = expandedFolders.has(node.path);

  return (
    <div className={`rag-debug-folder ${isExpanded ? 'expanded' : ''}`}>
      <div
        className="rag-debug-folder-name"
        onClick={() => onToggleFolder(node.path)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleFolder(node.path);
          }
        }}
        aria-expanded={isExpanded}
      >
        <span
          dangerouslySetInnerHTML={{
            __html: hasChildren
              ? isExpanded
                ? ICONS['chevron-down']
                : ICONS['chevron-right']
              : ICONS['chevron-right'],
          }}
        />
        <span dangerouslySetInnerHTML={{ __html: ICONS.folder }} />
        <span>{node.name}</span>
      </div>

      {isExpanded && (
        <div className="rag-debug-folder-content">
          {/* Render subfolders */}
          {Array.from(node.children.values()).map(child => (
            <FolderTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
            />
          ))}

          {/* Render files */}
          {node.files.map(file => {
            const fileName = file.path.split('/').pop() || file.title;
            return (
              <div
                key={file.path}
                className={`rag-debug-file ${file.isAdhoc ? 'adhoc' : ''}`}
                data-path={file.path}
              >
                <span dangerouslySetInnerHTML={{ __html: ICONS.file }} />
                <span>{fileName}</span>
                {file.isAdhoc && (
                  <span style={{ marginLeft: '4px', color: '#3b82f6' }}>(adhoc)</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Document tree panel with toolbar and tree view.
 *
 * Features:
 * - Fixed toolbar at top with Add Document, Clear DB, and Refresh buttons
 * - Scrollable folder tree view below
 * - Collapsible folders with chevron icons
 * - Adhoc document labeling
 * - Empty state when no documents
 *
 * @example
 * ```tsx
 * <DocumentsPanel
 *   documents={documents}
 *   onRefresh={() => refreshDocuments()}
 *   onAddDocument={() => showAddModal()}
 *   onClearDatabase={() => clearDatabase()}
 *   isLoading={false}
 * />
 * ```
 *
 * @public
 */
export function DocumentsPanel({
  documents,
  onRefresh,
  onAddDocument,
  onClearDatabase,
  isLoading,
}: DocumentsPanelProps): React.ReactElement {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Toggle folder expansion
  const handleToggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Build folder tree from documents
  const folderTree = useMemo(() => buildFolderTree(documents), [documents]);

  // Check if tree has any content
  const hasContent = folderTree.children.size > 0 || folderTree.files.length > 0;

  return (
    <div className="rag-debug-documents-container">
      {/* Toolbar */}
      <div className="rag-debug-toolbar">
        <button
          className="rag-debug-btn primary"
          onClick={onAddDocument}
          disabled={isLoading}
          type="button"
        >
          <span dangerouslySetInnerHTML={{ __html: ICONS.plus }} />
          <span>Add Document</span>
        </button>
        <button
          className="rag-debug-btn danger"
          onClick={onClearDatabase}
          disabled={isLoading}
          type="button"
        >
          <span dangerouslySetInnerHTML={{ __html: ICONS.trash }} />
          <span>Clear DB</span>
        </button>
        <button
          className="rag-debug-btn"
          onClick={onRefresh}
          disabled={isLoading}
          type="button"
        >
          <span dangerouslySetInnerHTML={{ __html: ICONS.refresh }} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tree View */}
      <div className="rag-debug-tree-scroll">
        {hasContent ? (
          <FolderTreeItem
            node={folderTree}
            expandedFolders={expandedFolders}
            onToggleFolder={handleToggleFolder}
          />
        ) : (
          <div className="rag-debug-empty">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5V19A9 3 0 0 0 21 19V5" />
              <path d="M3 12A9 3 0 0 0 21 12" />
            </svg>
            <p>No documents indexed yet.</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>
              Click &quot;Add Document&quot; to add content or &quot;Refresh&quot; to load existing documents.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DocumentsPanel;
