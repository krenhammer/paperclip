/**
 * @module turso-rag-debug/documents
 *
 * Document management for the Turso Browser RAG debug tool.
 *
 * Includes folder tree rendering, adhoc document management,
 * import/export, and database clearing.
 *
 * @packageDocumentation
 */

import type { DebugDocument, FolderNode } from './types';
import { state, debugDialog, getTursoRAGInstance } from './state';
import { ICONS } from './icons';
import {
  getAdhocDocuments,
  saveAdhocDocuments,
  ADHOC_DOCS_KEY
} from './utils';
import { addChatMessage } from './chat';

/**
 * Get all indexed documents from the RAG system
 *
 * @returns Promise resolving to array of debug documents
 * @public
 */
export async function getIndexedDocuments(): Promise<DebugDocument[]> {
  try {
    const tursoRAG = await getTursoRAGInstance();

    if (!tursoRAG.isReady()) {
      await tursoRAG.initialize();
    }

    // Get documents from the index (now async)
    const documents = await tursoRAG.getDocuments();

    // Get adhoc documents from localStorage
    const adhocDocs = getAdhocDocuments();

    // Add any adhoc documents that might not be in the index yet
    for (const adhoc of adhocDocs) {
      if (!documents.some(d => d.path === adhoc.path)) {
        documents.push({
          id: adhoc.id,
          title: adhoc.title,
          path: adhoc.path,
          category: 'adhoc',
          chunkCount: 1,
          isAdhoc: true,
        });
      }
    }

    return documents.sort((a, b) => a.path.localeCompare(b.path));
  } catch (error) {
    console.error('[turso-rag-debug] Failed to get indexed documents:', error);
    return [];
  }
}

/**
 * Refresh the document tree display
 *
 * @returns Promise resolving to array of debug documents (for React components)
 * @public
 */
export async function refreshDocuments(): Promise<DebugDocument[]> {
  const treeContainer = debugDialog?.querySelector('#turso-rag-doc-tree');

  state.isLoading = true;

  try {
    const docs = await getIndexedDocuments();
    state.documents = docs;

    // Update DOM if container exists (legacy vanilla JS mode)
    if (treeContainer) {
      if (docs.length === 0) {
        treeContainer.innerHTML = `
          <div class="turso-rag-empty">
            ${ICONS.database}
            <p>No documents indexed yet. Click "Refresh" to index documentation.</p>
          </div>
        `;
      } else {
        // Build folder tree structure
        const tree = buildFolderTree(docs);
        treeContainer.innerHTML = renderFolderTree(tree);

        // Add click handlers for expand/collapse
        treeContainer.querySelectorAll('.turso-rag-folder-name').forEach((el) => {
          el.addEventListener('click', (e) => {
            const folder = (e.currentTarget as HTMLElement).closest('.turso-rag-folder');
            folder?.classList.toggle('expanded');
          });
        });
      }
    }

    return docs;
  } catch (error) {
    console.error('[turso-rag-debug] Failed to refresh documents:', error);
    if (treeContainer) {
      treeContainer.innerHTML = `
        <div class="turso-rag-empty">
          ${ICONS.database}
          <p>Error loading documents</p>
          <p style="font-size: 11px; margin-top: 8px;">${error instanceof Error ? error.message : String(error)}</p>
          <button class="turso-rag-btn" style="margin-top: 12px;" id="turso-rag-retry-load">
            ${ICONS.refresh} Retry
          </button>
        </div>
      `;
      treeContainer.querySelector('#turso-rag-retry-load')?.addEventListener('click', () => {
        void refreshDocuments();
      });
    }
    return [];
  } finally {
    state.isLoading = false;
  }
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
    // Parse path like 'guide/platform/index.mdx'
    const parts = doc.path.split('/').filter(p => p && !p.endsWith('.mdx') && !p.endsWith('.md'));

    let current = root;

    for (let i = 0; i < parts.length; i++) {
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
 * Render the folder tree as HTML
 *
 * @param node - Current folder node
 * @param level - Current nesting level
 * @returns HTML string
 * @internal
 */
function renderFolderTree(node: FolderNode, level = 0): string {
  if (level === 0) {
    // Root level - render children
    const children = Array.from(node.children.values());
    return `<div class="turso-rag-folder-tree">${children.map(child => renderFolderTree(child, level + 1)).join('')}</div>`;
  }

  const hasChildren = node.children.size > 0;
  const hasFiles = node.files.length > 0;

  let html = `<div class="turso-rag-folder expanded">`;

  // Folder header
  html += `
    <div class="turso-rag-folder-name">
      ${hasChildren ? ICONS['chevron-down'] : ICONS['chevron-right']}
      ${ICONS.folder}
      <span>${node.name}</span>
    </div>
  `;

  // Folder contents
  html += `<div class="turso-rag-folder-content">`;

  // Render subfolders
  for (const child of node.children.values()) {
    html += renderFolderTree(child, level + 1);
  }

  // Render files
  for (const file of node.files) {
    const fileName = file.path.split('/').pop() || file.title;
    html += `
      <div class="turso-rag-file ${file.isAdhoc ? 'adhoc' : ''}" data-path="${file.path}">
        ${ICONS.file}
        <span>${fileName}</span>
        ${file.isAdhoc ? '<span style="margin-left: 4px; color: #3b82f6;">(adhoc)</span>' : ''}
      </div>
    `;
  }

  html += `</div></div>`;

  return html;
}

/**
 * Show modal to add an adhoc document
 *
 * @public
 */
export function showAddDocumentModal(): void {
  const modal = document.createElement('div');
  modal.className = 'turso-rag-modal-overlay';
  modal.id = 'turso-rag-add-modal';

  modal.innerHTML = `
    <div class="turso-rag-modal">
      <div class="turso-rag-modal-header">
        <h4>Add Adhoc Document</h4>
        <button class="turso-rag-close" aria-label="Close">${ICONS.close}</button>
      </div>
      <div class="turso-rag-modal-body">
        <div class="turso-rag-form-group">
          <label for="adhoc-title">Document Title</label>
          <input type="text" id="adhoc-title" placeholder="e.g., Custom Notes">
        </div>
        <div class="turso-rag-form-group">
          <label for="adhoc-path">Path (optional)</label>
          <input type="text" id="adhoc-path" placeholder="e.g., custom/notes.mdx">
        </div>
        <div class="turso-rag-form-group">
          <label for="adhoc-content">Content</label>
          <textarea id="adhoc-content" placeholder="Enter document content here..."></textarea>
        </div>
      </div>
      <div class="turso-rag-modal-footer">
        <button class="turso-rag-btn" id="adhoc-cancel">Cancel</button>
        <button class="turso-rag-btn primary" id="adhoc-save">Add Document</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event handlers
  modal.querySelector('.turso-rag-close')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#adhoc-cancel')?.addEventListener('click', () => modal.remove());

  modal.querySelector('#adhoc-save')?.addEventListener('click', async () => {
    const titleInput = modal.querySelector('#adhoc-title') as HTMLInputElement;
    const pathInput = modal.querySelector('#adhoc-path') as HTMLInputElement;
    const contentInput = modal.querySelector('#adhoc-content') as HTMLTextAreaElement;

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    let path = pathInput.value.trim();

    if (!title || !content) {
      alert('Title and content are required');
      return;
    }

    // Generate path if not provided
    if (!path) {
      path = `adhoc/${title.toLowerCase().replace(/\s+/g, '-')}.mdx`;
    }

    await addAdhocDocument(title, path, content);
    modal.remove();
    void refreshDocuments();
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Focus title input
  setTimeout(() => {
    (modal.querySelector('#adhoc-title') as HTMLInputElement)?.focus();
  }, 100);
}

/**
 * Add an adhoc document to the index
 *
 * @param title - Document title
 * @param path - Virtual file path
 * @param content - Document content
 * @public
 */
export async function addAdhocDocument(title: string, path: string, content: string): Promise<void> {
  try {
    // Store in localStorage for persistence
    const adhocDocs = getAdhocDocuments();
    adhocDocs.push({
      id: `adhoc-${Date.now()}`,
      title,
      path,
      content,
    });
    saveAdhocDocuments(adhocDocs);

    // Reload to pick up the new document
    const tursoRAG = await getTursoRAGInstance();
    await tursoRAG.reload();

    // Show success in chat
    await addChatMessage('system', `Added adhoc document: "${title}"`);
  } catch (error) {
    console.error('[turso-rag-debug] Failed to add adhoc document:', error);
    alert('Failed to add document. See console for details.');
  }
}

/**
 * Remove an adhoc document
 *
 * @param path - Path of the document to remove
 * @public
 */
export async function removeAdhocDocument(path: string): Promise<void> {
  try {
    const adhocDocs = getAdhocDocuments().filter(d => d.path !== path);
    saveAdhocDocuments(adhocDocs);

    // Reindex to remove
    const tursoRAG = await getTursoRAGInstance();
    await tursoRAG.reload();

    await addChatMessage('system', `Removed adhoc document: "${path}"`);
    void refreshDocuments();
  } catch (error) {
    console.error('[turso-rag-debug] Failed to remove adhoc document:', error);
  }
}

/**
 * Show confirmation modal for clearing the database
 *
 * @public
 */
export function showClearDatabaseConfirmModal(): void {
  const modal = document.createElement('div');
  modal.className = 'turso-rag-modal-overlay';
  modal.id = 'turso-rag-clear-confirm-modal';

  modal.innerHTML = `
    <div class="turso-rag-modal">
      <div class="turso-rag-modal-header">
        <h4>Clear Database</h4>
        <button class="turso-rag-close" aria-label="Close">${ICONS.close}</button>
      </div>
      <div class="turso-rag-modal-body">
        <p>Are you sure you want to clear the entire database?</p>
        <p class="turso-rag-warning-text">This will remove all indexed documents. Click "Reload" afterwards to reindex.</p>
      </div>
      <div class="turso-rag-modal-footer">
        <button class="turso-rag-btn" id="clear-confirm-cancel">Cancel</button>
        <button class="turso-rag-btn danger" id="clear-confirm-ok">Clear Database</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event handlers
  const closeModal = () => modal.remove();

  modal.querySelector('.turso-rag-close')?.addEventListener('click', closeModal);
  modal.querySelector('#clear-confirm-cancel')?.addEventListener('click', closeModal);

  modal.querySelector('#clear-confirm-ok')?.addEventListener('click', async () => {
    closeModal();
    await clearDatabase();
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

/**
 * Clear the entire database.
 *
 * IMPORTANT: This does NOT auto-reload. The user must click "Reload"
 * to reindex documents after clearing.
 *
 * @public
 */
export async function clearDatabase(): Promise<void> {
  try {
    // Clear adhoc documents from localStorage
    localStorage.removeItem(ADHOC_DOCS_KEY);

    // Clear the RAG index (but don't reload)
    const tursoRAG = await getTursoRAGInstance();
    await tursoRAG.clearIndex();

    // Clear documents from state and UI
    state.documents = [];
    const treeContainer = debugDialog?.querySelector('#turso-rag-doc-tree');
    if (treeContainer) {
      treeContainer.innerHTML = `
        <div class="turso-rag-empty">
          ${ICONS.database}
          <p>Database cleared. Click "Reload" to reindex documents.</p>
        </div>
      `;
    }

    await addChatMessage('system', 'Database cleared. Click "Reload" to reindex documents.');
  } catch (error) {
    console.error('[turso-rag-debug] Failed to clear database:', error);
    await addChatMessage('system', 'Failed to clear database. See console for details.');
  }
}

/**
 * Reload all documents (reindex)
 *
 * @public
 */
export async function reloadDocuments(): Promise<void> {
  try {
    state.isLoading = true;

    const tursoRAG = await getTursoRAGInstance();
    await tursoRAG.reload((progress) => {
      // Progress updates handled by UI subscribers
      console.log(`[turso-rag-debug] Reload progress: ${progress.progress}%`);
    });

    await addChatMessage('system', 'Documents reloaded successfully');
    void refreshDocuments();
  } catch (error) {
    console.error('[turso-rag-debug] Failed to reload documents:', error);
    alert('Failed to reload documents. See console for details.');
  } finally {
    state.isLoading = false;
  }
}
