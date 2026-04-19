/**
 * @module turso-rag-debug/state
 *
 * Shared state management for the Turso Browser RAG debug tool.
 *
 * @packageDocumentation
 */

import type { DebugState, ChatMessage } from './types';

/**
 * Global state for the debug tool
 * @public
 */
export const state: DebugState = {
  isOpen: false,
  activeTab: 'documents',
  documents: [],
  chatMessages: [],
  isLoading: false,
};

/**
 * Subscription callbacks for chat message changes
 */
type ChatMessageListener = (messages: ChatMessage[]) => void;
const chatMessageListeners: Set<ChatMessageListener> = new Set();

/**
 * Subscribe to chat message changes
 * @param listener - Callback to be called when chat messages change
 * @returns Unsubscribe function
 * @public
 */
export function subscribeToChatMessages(listener: ChatMessageListener): () => void {
  chatMessageListeners.add(listener);
  listener(state.chatMessages);

  return () => {
    chatMessageListeners.delete(listener);
  };
}

/**
 * Notify all listeners of chat message changes
 * @internal
 */
export function notifyChatMessageListeners(): void {
  chatMessageListeners.forEach(listener => {
    listener(state.chatMessages);
  });
}

/**
 * Reference to the dialog element
 * @public
 */
export let debugDialog: HTMLElement | null = null;

/**
 * Reference to the floating button
 * @public
 */
export let floatingButton: HTMLElement | null = null;

/**
 * Set the debug dialog element reference
 * @public
 */
export function setDebugDialog(el: HTMLElement | null): void {
  debugDialog = el;
}

/**
 * Set the floating button element reference
 * @public
 */
export function setFloatingButton(el: HTMLElement | null): void {
  floatingButton = el;
}

/**
 * Whether auto-initialization is in progress
 * @internal
 */
export let autoInitStarted = false;

/**
 * Mark that auto-initialization has started
 * @internal
 */
export function markAutoInitStarted(): void {
  autoInitStarted = true;
}

/**
 * Reference to the tursoRAG module for lazy loading
 * @internal
 */
let tursoRAGModule: typeof import('./turso-rag') | null = null;

/**
 * Get the tursoRAG module, caching the import
 * @public
 */
export async function getTursoRAG(): Promise<typeof import('./turso-rag')> {
  if (!tursoRAGModule) {
    tursoRAGModule = await import('./turso-rag');
  }
  return tursoRAGModule;
}

/**
 * Get the TursoRAG instance
 * @public
 */
export async function getTursoRAGInstance(): Promise<typeof import('./turso-rag')['tursoRAG']> {
  const mod = await getTursoRAG();
  return mod.tursoRAG;
}

/**
 * Get the prebuiltRAG module (alias for getTursoRAG for compatibility with React components)
 * @public
 */
export async function getPrebuiltRAG(): Promise<typeof import('./turso-rag')> {
  return getTursoRAG();
}
