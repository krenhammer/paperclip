/**
 * @module turso-rag-debug/utils
 *
 * Utility functions for the Turso Browser RAG debug tool.
 *
 * @packageDocumentation
 */

/**
 * Escape HTML entities to prevent XSS
 *
 * @param text - Raw text that may contain HTML
 * @returns Escaped HTML string
 * @public
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format timestamp as HH:MM
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string
 * @public
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Check if debug mode is enabled via environment variable
 * Uses multiple methods: import.meta.env, window global, localStorage
 *
 * @returns Whether debug mode is enabled
 * @public
 */
export function checkDebugEnabled(): boolean {
  // Check build-time env var (Vite)
  // @ts-ignore - import.meta.env is available in Vite but TypeScript may not know
  const envValue = import.meta.env?.VITE_TURSO_RAG_DEBUG;
  if (envValue === 'true') {
    return true;
  }

  // Check window global (set by build process as fallback)
  if (typeof window !== 'undefined') {
    const win = window as typeof window & {
      __PAPERCLIP_CONFIG__?: { VITE_TURSO_RAG_DEBUG?: string | boolean };
    };
    const windowValue = win.__PAPERCLIP_CONFIG__?.VITE_TURSO_RAG_DEBUG;
    if (windowValue === true || windowValue === 'true') {
      return true;
    }
  }

  // Check localStorage override (for debugging)
  try {
    const lsValue = localStorage.getItem('paperclip-turso-rag-debug-force');
    if (lsValue === 'true') {
      return true;
    }
  } catch {
    // Ignore
  }

  return false;
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

/**
 * Storage key for adhoc documents in localStorage
 * @internal
 */
export const ADHOC_DOCS_KEY = 'paperclip-turso-rag-adhoc';

/**
 * Get adhoc documents from localStorage
 *
 * @returns Array of adhoc documents
 * @public
 */
export function getAdhocDocuments(): Array<{ id: string; title: string; path: string; content: string }> {
  try {
    const stored = localStorage.getItem(ADHOC_DOCS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save adhoc documents to localStorage
 *
 * @param docs - Array of adhoc documents to save
 * @public
 */
export function saveAdhocDocuments(docs: Array<{ id: string; title: string; path: string; content: string }>): void {
  localStorage.setItem(ADHOC_DOCS_KEY, JSON.stringify(docs));
}
