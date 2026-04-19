/**
 * @module turso-rag-debug/turso-rag
 *
 * Turso Browser RAG implementation using @tursodatabase/api.
 *
 * This module provides a browser-based RAG system using Turso's libSQL
 * with pre-built embeddings loaded from rag-index.yml.
 *
 * @packageDocumentation
 */

import { createClient, type Client } from '@libsql/client';
import * as yaml from 'js-yaml';
import type {
  PrebuiltIndex,
  PrebuiltChunk,
  SearchResult,
  DebugDocument,
  InitializationProgress,
  TursoRAG as TursoRAGInterface,
} from './types';

// Configuration constants
const DB_CONFIG = {
  /** IndexedDB database name (used as namespace) */
  DB_NAME: 'paperclip-turso-rag-v1',
  /** Vector dimensions (matches all-MiniLM-L6-v2) */
  DIMENSIONS: 384,
  /** Distance metric for similarity search */
  METRIC: 'cosine' as const,
  /** Prebuilt index URL */
  INDEX_URL: '/vowel-rag/rag-index.yml',
  /** Storage key for tracking loaded index */
  LOADED_KEY: 'paperclip-turso-rag-loaded',
  /** Default chunks to retrieve per search */
  DEFAULT_K: 5,
};

/** Global initialization state for UI feedback */
interface InitializationState {
  isInitializing: boolean;
  progress: number;
  stage: InitializationProgress['stage'];
  totalChunks: number;
  processedChunks: number;
  error: string | null;
  message: string;
}

const initializationState: InitializationState = {
  isInitializing: false,
  progress: 0,
  stage: 'fetching',
  totalChunks: 0,
  processedChunks: 0,
  error: null,
  message: 'Not initialized',
};

/** Set of state subscribers */
const stateSubscribers = new Set<() => void>();

/**
 * Notify all subscribers of state change
 */
function notifyStateChange(): void {
  for (const subscriber of stateSubscribers) {
    try {
      subscriber();
    } catch (error) {
      console.warn('[turso-rag] State subscriber error:', error);
    }
  }
}

/**
 * Update initialization state and notify subscribers
 */
function updateState(updates: Partial<InitializationState>): void {
  Object.assign(initializationState, updates);
  notifyStateChange();
}

/**
 * Get the current initialization state
 */
export function getInitializationState(): InitializationState {
  return { ...initializationState };
}

/**
 * Subscribe to initialization state changes
 */
export function subscribeToInitializationState(callback: (state: InitializationState) => void): () => void {
  const wrappedCallback = () => callback(getInitializationState());
  stateSubscribers.add(wrappedCallback);
  return () => stateSubscribers.delete(wrappedCallback);
}

/** Turso client instance */
let tursoClient: Client | null = null;

/** Prebuilt index cache */
let prebuiltIndex: PrebuiltIndex | null = null;

/** Initialization state */
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Get or create the Turso client instance.
 * Uses an in-memory database for browser-based RAG.
 */
async function getTursoClient(): Promise<Client> {
  if (tursoClient) return tursoClient;

  if (typeof window === 'undefined') {
    throw new Error('Turso RAG can only be used in browser environment');
  }

  // Create in-memory Turso client
  tursoClient = createClient({
    url: ':memory:',
  });

  return tursoClient;
}

/**
 * Initialize the vector search schema in Turso
 */
async function initSchema(db: Client): Promise<void> {
  // Create documents table with vector support
  await db.execute(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      vector F32_BLOB(${DB_CONFIG.DIMENSIONS}),
      metadata TEXT
    )
  `);

  // Create vector index for similarity search
  try {
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_documents_vector
      ON documents (libsql_vector_idx(vector))
    `);
  } catch (error) {
    // Vector index might not be supported in all Turso versions
    console.warn('[turso-rag] Vector index creation failed (may not be supported):', error);
  }
}

/**
 * Fetch the prebuilt index from the server
 */
async function fetchPrebuiltIndex(): Promise<PrebuiltIndex> {
  console.log('[turso-rag] Fetching prebuilt index...');

  const response = await fetch(DB_CONFIG.INDEX_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch prebuilt index: ${response.status} ${response.statusText}`);
  }

  const yamlText = await response.text();
  console.log(`[turso-rag] Fetched ${yamlText.length} bytes`);

  if (!yamlText || yamlText.trim().length === 0) {
    throw new Error('Prebuilt index file is empty');
  }

  // Check for fetch of HTML error page instead of YAML
  if (yamlText.trim().startsWith('<!DOCTYPE') || yamlText.trim().startsWith('<html')) {
    throw new Error('Received HTML instead of YAML - prebuilt index file not found at ' + DB_CONFIG.INDEX_URL);
  }

  let index: unknown;
  try {
    index = yaml.load(yamlText);
  } catch (parseError) {
    console.error('[turso-rag] YAML parse error:', parseError);
    throw new Error(`Failed to parse prebuilt index YAML: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }

  if (!index || typeof index !== 'object') {
    throw new Error('Failed to parse prebuilt index: invalid YAML structure');
  }

  const prebuiltIndex = index as PrebuiltIndex;

  if (typeof prebuiltIndex.chunk_count !== 'number' || !Array.isArray(prebuiltIndex.chunks)) {
    throw new Error(`Prebuilt index missing required fields`);
  }

  console.log(`[turso-rag] Loaded prebuilt index: ${prebuiltIndex.chunk_count} chunks, model: ${prebuiltIndex.model}`);

  return prebuiltIndex;
}

/**
 * Check if the prebuilt index has already been loaded
 */
function isAlreadyLoaded(): boolean {
  try {
    const loaded = localStorage.getItem(DB_CONFIG.LOADED_KEY);
    if (!loaded) return false;

    const { version, timestamp } = JSON.parse(loaded);
    // Check version match and index is less than 30 days old
    const isRecent = Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000;
    return version === DB_CONFIG.DB_NAME && isRecent;
  } catch {
    return false;
  }
}

/**
 * Mark the prebuilt index as loaded in localStorage
 */
function markAsLoaded(count: number): void {
  try {
    localStorage.setItem(
      DB_CONFIG.LOADED_KEY,
      JSON.stringify({
        version: DB_CONFIG.DB_NAME,
        timestamp: Date.now(),
        count: count,
      })
    );
  } catch (error) {
    console.warn('[turso-rag] Failed to mark as loaded:', error);
  }
}

/**
 * Convert a vector array to a string format for Turso
 */
function vectorToString(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

/**
 * Load the prebuilt index into Turso
 */
async function loadPrebuiltIndex(
  db: Client,
  index: PrebuiltIndex,
  progressCallback?: (progress: InitializationProgress) => void
): Promise<void> {
  console.log('[turso-rag] Loading prebuilt index into Turso...');
  const startTime = performance.now();

  if (index.chunks.length === 0) {
    console.warn('[turso-rag] No chunks in prebuilt index');
    updateState({ stage: 'complete', progress: 100, isInitializing: false, message: 'No chunks to load' });
    progressCallback?.({ stage: 'complete', progress: 100, total: 0, processed: 0, message: 'No chunks to load' });
    return;
  }

  updateState({ totalChunks: index.chunks.length, processedChunks: 0, stage: 'indexing', message: `Loading ${index.chunks.length} chunks...` });

  // Clear existing data
  await db.execute('DELETE FROM documents');

  // Insert chunks in batches
  const BATCH_SIZE = 50;
  const totalBatches = Math.ceil(index.chunks.length / BATCH_SIZE);

  for (let i = 0; i < index.chunks.length; i += BATCH_SIZE) {
    const batch = index.chunks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    // Build batch insert
    const values: (string | number)[] = [];
    const placeholders: string[] = [];

    for (const chunk of batch) {
      const vectorData = chunk.vector || chunk.embedding;
      if (!vectorData) continue;

      placeholders.push('(?, ?, vector32(?), ?)');
      values.push(
        chunk.id,
        chunk.text,
        vectorToString(vectorData),
        JSON.stringify(chunk.metadata)
      );
    }

    if (placeholders.length > 0) {
      const sql = `INSERT INTO documents (id, text, vector, metadata) VALUES ${placeholders.join(', ')}`;
      await db.execute({ sql, args: values });
    }

    const processed = Math.min(i + batch.length, index.chunks.length);
    const progress = Math.round((processed / index.chunks.length) * 100);

    updateState({ processedChunks: processed, progress, message: `Loading batch ${batchNum}/${totalBatches}...` });

    const message = `Loading batch ${batchNum}/${totalBatches} (${batch.length} chunks)`;
    console.log(`[turso-rag] ${message}`);

    progressCallback?.({
      stage: 'indexing',
      progress,
      total: index.chunks.length,
      processed,
      message,
    });
  }

  const duration = Math.round(performance.now() - startTime);
  console.log(`[turso-rag] Index loaded: ${index.chunks.length} chunks in ${duration}ms`);

  updateState({ stage: 'complete', progress: 100, isInitializing: false, message: `Loaded ${index.chunks.length} chunks` });
  progressCallback?.({
    stage: 'complete',
    progress: 100,
    total: index.chunks.length,
    processed: index.chunks.length,
    message: `Loaded ${index.chunks.length} chunks in ${duration}ms`,
  });

  markAsLoaded(index.chunks.length);
}

/**
 * Initialize the Turso RAG system
 */
async function initialize(progressCallback?: (progress: InitializationProgress) => void): Promise<void> {
  if (isInitialized) {
    progressCallback?.({
      stage: 'complete',
      progress: 100,
      total: prebuiltIndex?.chunk_count || 0,
      processed: prebuiltIndex?.chunk_count || 0,
      message: 'Already initialized',
    });
    return;
  }

  if (initializationPromise) {
    const unsubscribe = subscribeToInitializationState((state) => {
      if (state.stage !== 'complete' && state.stage !== 'error') {
        progressCallback?.({
          stage: state.stage,
          progress: state.progress,
          total: state.totalChunks,
          processed: state.processedChunks,
          message: state.error || `Loading... (${state.progress}%)`,
        });
      }
    });
    await initializationPromise;
    unsubscribe();
    return initializationPromise;
  }

  updateState({ isInitializing: true, stage: 'fetching', progress: 0, error: null, message: 'Starting initialization...' });
  progressCallback?.({
    stage: 'fetching',
    progress: 0,
    total: 0,
    processed: 0,
    message: 'Starting initialization...',
  });

  initializationPromise = (async () => {
    try {
      console.log('[turso-rag] Initializing Turso RAG system...');

      updateState({ stage: 'loading', progress: 10, message: 'Initializing Turso client...' });
      progressCallback?.({ stage: 'loading', progress: 10, total: 0, processed: 0, message: 'Initializing Turso client...' });

      const db = await getTursoClient();

      updateState({ stage: 'loading', progress: 20, message: 'Setting up schema...' });
      progressCallback?.({ stage: 'loading', progress: 20, total: 0, processed: 0, message: 'Setting up schema...' });

      await initSchema(db);

      // Check if we need to load the prebuilt index
      if (!isAlreadyLoaded() || prebuiltIndex === null) {
        console.log('[turso-rag] Loading prebuilt index...');

        updateState({ stage: 'fetching', progress: 30, message: 'Fetching prebuilt index...' });
        progressCallback?.({ stage: 'fetching', progress: 30, total: 0, processed: 0, message: 'Fetching prebuilt index...' });

        // Fetch the prebuilt index
        const index = await fetchPrebuiltIndex();
        prebuiltIndex = index;

        updateState({ totalChunks: index.chunk_count, stage: 'loading', progress: 50, message: `Fetched ${index.chunk_count} chunks...` });
        progressCallback?.({ stage: 'loading', progress: 50, total: index.chunk_count, processed: 0, message: `Fetched ${index.chunk_count} chunks...` });

        // Load the prebuilt chunks with their embeddings
        await loadPrebuiltIndex(db, index, progressCallback);
      } else {
        const stats = JSON.parse(localStorage.getItem(DB_CONFIG.LOADED_KEY) || '{}');
        const count = stats.count || 'unknown';
        console.log(`[turso-rag] Using existing index with ${count} chunks`);

        // Still need to load prebuiltIndex for getDocuments() to work
        if (prebuiltIndex === null) {
          prebuiltIndex = await fetchPrebuiltIndex();
        }

        const cachedMsg = `Using cached index (${count} chunks)`;
        updateState({ stage: 'complete', progress: 100, isInitializing: false, message: cachedMsg });
        progressCallback?.({ stage: 'complete', progress: 100, total: typeof count === 'number' ? count : 0, processed: typeof count === 'number' ? count : 0, message: cachedMsg });
      }

      isInitialized = true;
      console.log('[turso-rag] Initialization complete');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[turso-rag] Initialization failed:', error);
      updateState({ stage: 'error', isInitializing: false, error: errorMsg, message: `Error: ${errorMsg}` });
      progressCallback?.({ stage: 'error', progress: 0, total: 0, processed: 0, message: `Error: ${errorMsg}` });
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Search the documentation for relevant chunks
 */
async function search(query: string, k: number = DB_CONFIG.DEFAULT_K): Promise<SearchResult[]> {
  console.log('[turso-rag] search() called with query:', query, 'k:', k);

  if (!isInitialized) {
    await initialize();
  }

  const db = await getTursoClient();

  // For now, use a simple text-based search since vector similarity
  // might not be available in all Turso builds
  // We'll use the query-embeddings.ts module to get embeddings and then search
  const { getQueryEmbedding } = await import('../../../public/vowel-rag/query-embeddings');

  try {
    const queryVector = await getQueryEmbedding(query);
    const vectorStr = vectorToString(queryVector);

    // Try vector distance search first
    const results = await db.execute({
      sql: `
        SELECT id, text, metadata,
               vector_distance_cos(vector, vector32(?)) as score
        FROM documents
        ORDER BY score
        LIMIT ?
      `,
      args: [vectorStr, k],
    });

    return results.rows.map((row: Record<string, unknown>) => ({
      text: String(row.text),
      score: Number(row.score),
      metadata: JSON.parse(String(row.metadata)),
    }));
  } catch (error) {
    console.warn('[turso-rag] Vector search failed, falling back to text search:', error);

    // Fallback: simple text search with LIKE
    const fallbackResults = await db.execute({
      sql: `
        SELECT id, text, metadata, 0.5 as score
        FROM documents
        WHERE text LIKE ?
        LIMIT ?
      `,
      args: [`%${query}%`, k],
    });

    return fallbackResults.rows.map((row: Record<string, unknown>) => ({
      text: String(row.text),
      score: Number(row.score),
      metadata: JSON.parse(String(row.metadata)),
    }));
  }
}

/**
 * Check if the RAG system is initialized and ready
 */
function checkReady(): boolean {
  return isInitialized;
}

/**
 * Get the total number of indexed chunks
 */
async function getIndexSize(): Promise<number> {
  if (!isInitialized) {
    await initialize();
  }
  const db = await getTursoClient();
  const result = await db.execute('SELECT COUNT(*) as count FROM documents');
  return Number(result.rows[0]?.count || 0);
}

/**
 * Force reload the prebuilt index
 */
async function reload(progressCallback?: (progress: InitializationProgress) => void): Promise<void> {
  console.log('[turso-rag] Starting reload...');
  isInitialized = false;
  prebuiltIndex = null;
  updateState({ isInitializing: true, stage: 'fetching', progress: 0, error: null, message: 'Reloading index...' });

  try {
    localStorage.removeItem(DB_CONFIG.LOADED_KEY);
    const db = await getTursoClient();
    await db.execute('DELETE FROM documents');
    await initialize(progressCallback);
    console.log('[turso-rag] Reload complete');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[turso-rag] Reload failed:', error);
    updateState({ stage: 'error', isInitializing: false, error: errorMsg, message: `Error: ${errorMsg}` });
    throw error;
  }
}

/**
 * Clear the vector database without reinitializing
 */
async function clearIndex(): Promise<void> {
  console.log('[turso-rag] Clearing index...');
  isInitialized = false;
  prebuiltIndex = null;

  try {
    localStorage.removeItem(DB_CONFIG.LOADED_KEY);
    const db = await getTursoClient();
    await db.execute('DELETE FROM documents');
    updateState({ isInitializing: false, stage: 'complete', progress: 0, error: null, message: 'Index cleared' });
    console.log('[turso-rag] Index cleared');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[turso-rag] Clear failed:', error);
    updateState({ stage: 'error', isInitializing: false, error: errorMsg, message: `Error: ${errorMsg}` });
    throw error;
  }
}

/**
 * Get all unique documents from the prebuilt index
 */
function getDocuments(): DebugDocument[] {
  if (!prebuiltIndex) {
    return [];
  }

  // Group chunks by document path
  const docMap = new Map<string, { title: string; path: string; category: string; totalChunks: number }>();

  for (const chunk of prebuiltIndex.chunks) {
    const { path, title, category, totalChunks } = chunk.metadata;

    if (!docMap.has(path)) {
      docMap.set(path, { title, path, category, totalChunks });
    }
  }

  // Convert to array
  const documents = Array.from(docMap.values()).map(doc => ({
    id: doc.path,
    title: doc.title,
    path: doc.path,
    category: doc.category,
    chunkCount: doc.totalChunks,
    isAdhoc: false,
  }));

  return documents.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Turso RAG instance for Paperclip.
 * Provides semantic search over documentation using Turso's in-browser vector search.
 */
export const tursoRAG: TursoRAGInterface = {
  initialize,
  search,
  isReady: checkReady,
  getIndexSize,
  reload,
  clearIndex,
  getDocuments,
};

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__paperclipTursoRAG = {
    tursoRAG,
    reload,
    search: (q: string) => tursoRAG.search(q),
    size: () => tursoRAG.getIndexSize(),
    getDocuments: () => tursoRAG.getDocuments(),
    getState: getInitializationState,
  };
}
