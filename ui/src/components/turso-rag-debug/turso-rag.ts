/**
 * @module turso-rag-debug/turso-rag
 *
 * Browser RAG using **Turso `@tursodatabase/database-wasm`** (same setup as
 * `docs/.vitepress/theme/prebuilt-rag.ts`): persistent or in-memory libSQL with
 * vector search over a pre-built YAML index.
 *
 * Requires cross-origin isolation (COOP/COEP) — see `ui/vite.config.ts` `server.headers`.
 *
 * @packageDocumentation
 */

import * as yaml from 'js-yaml';
import { connect, type Database } from '@tursodatabase/database-wasm/vite';
import type {
  PrebuiltChunk,
  PrebuiltIndex,
  SearchResult,
  InitializationProgress,
  DebugDocument,
  TursoRAG as TursoRAGInterface,
} from './types';
import { getQueryEmbedding } from '../../../public/vowel-rag/query-embeddings';

const LOG_PREFIX = '[turso-rag]';

function log(message: string, ...args: unknown[]): void {
  console.log(`${LOG_PREFIX}: ${message}`, ...args);
}

function warn(message: string, ...args: unknown[]): void {
  console.warn(`${LOG_PREFIX}: ${message}`, ...args);
}

function errorLog(message: string, ...args: unknown[]): void {
  console.error(`${LOG_PREFIX}: ${message}`, ...args);
}

/** Deterministic cache row stored in localStorage (same shape as VowelDocs prebuilt-rag) */
interface CacheMetadata {
  dbName: string;
  manifestHash: string;
  chunkHashes: Record<string, string>;
  chunkCount: number;
  syncedAt: number;
}

/**
 * Initialization state mirrored for UI subscribers (matches docs `InitializationState`).
 *
 * @public
 */
export interface InitializationState {
  isInitializing: boolean;
  progress: number;
  stage: InitializationProgress['stage'];
  totalChunks: number;
  processedChunks: number;
  error: string | null;
  message: string;
}

// =============================================================================
// STATE
// =============================================================================

/** Global initialization state for UI feedback */
const initializationState: InitializationState = {
  isInitializing: false,
  progress: 0,
  stage: 'fetching',
  totalChunks: 0,
  processedChunks: 0,
  error: null,
  message: 'Not initialized',
};

/**
 * Get the current initialization state
 * @returns Current state (useful for UI progress indicators)
 * @public
 */
export function getInitializationState(): InitializationState {
  return { ...initializationState };
}

/**
 * Subscribe to initialization state changes
 * @param callback - Called whenever state changes
 * @returns Unsubscribe function
 * @public
 */
export function subscribeToInitializationState(callback: (state: InitializationState) => void): () => void {
  const wrappedCallback = () => callback(getInitializationState());
  stateSubscribers.add(wrappedCallback);
  return () => stateSubscribers.delete(wrappedCallback);
}

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
      warn('State subscriber error', error);
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

// =============================================================================
// CONFIGURATION
// =============================================================================

const DB_CONFIG = {
  /** Distinct from VowelDocs so IndexedDB does not clash when both apps run on localhost */
  DB_NAME: 'paperclip-turso-rag-v2.db',
  MEMORY_DB_NAME: ':memory:',
  CONNECT_TIMEOUT_MS: 4000,
  CHUNKS_TABLE: 'rag_chunks',
  /** Vector dimensions (matches Xenova/all-MiniLM-L6-v2) */
  DIMENSIONS: 384,
  /** Distance metric for similarity search */
  METRIC: 'cosine' as const,
  DEFAULT_K: 5,
  LOADED_KEY: 'paperclip-turso-rag-loaded',
  CACHE_META_KEY: 'paperclip-turso-rag-cache-meta',
  /** Served from `ui/public/vowel-rag/` */
  INDEX_URL: '/vowel-rag/rag-index.yml',
};

type TursoDatabase = Database;

let vectorDB: TursoDatabase | null = null;
let databaseMode: 'persistent' | 'memory' | null = null;

/** Prebuilt index cache */
let prebuiltIndex: PrebuiltIndex | null = null;

/** Initialization state */
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function getVectorDB(): Promise<TursoDatabase> {
  if (vectorDB) return vectorDB;

  if (typeof window === 'undefined') {
    throw new Error('Prebuilt RAG can only be used in browser environment');
  }

  // if (!window.crossOriginIsolated) {
  //   throw new Error(
  //     'Turso Browser RAG requires cross-origin isolation. The Paperclip UI dev server sets Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy in vite.config.ts; production must send the same headers.'
  //   );
  // }

  const openDatabase = async (databaseName: string): Promise<TursoDatabase> => {
    const db = await connect(databaseName);
    await ensureSchema(db);
    return db;
  };

  try {
    vectorDB = await Promise.race([
      openDatabase(DB_CONFIG.DB_NAME),
      new Promise<TursoDatabase>((_, reject) => {
        window.setTimeout(() => {
          reject(new Error(`Timed out opening ${DB_CONFIG.DB_NAME}`));
        }, DB_CONFIG.CONNECT_TIMEOUT_MS);
      }),
    ]);
    databaseMode = 'persistent';
  } catch (error) {
    warn('Falling back to in-memory Turso database', error);
    vectorDB = await openDatabase(DB_CONFIG.MEMORY_DB_NAME);
    databaseMode = 'memory';
  }

  return vectorDB;
}

function numberFromSqlValue(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`Expected numeric SQL value, received ${String(value)}`);
}

async function ensureSchema(db: TursoDatabase): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ${DB_CONFIG.CHUNKS_TABLE} (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      metadata TEXT NOT NULL,
      embedding F32_BLOB(${DB_CONFIG.DIMENSIONS}) NOT NULL
    );
  `);
}

async function getStoredChunkCount(db: TursoDatabase): Promise<number> {
  const countRow = await db.prepare(`SELECT COUNT(*) AS count FROM ${DB_CONFIG.CHUNKS_TABLE}`).get() as { count?: unknown } | undefined;
  return countRow?.count === undefined ? 0 : numberFromSqlValue(countRow.count);
}

async function clearDatabase(db: TursoDatabase): Promise<void> {
  await db.exec(`DELETE FROM ${DB_CONFIG.CHUNKS_TABLE}`);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

function validateVector(chunk: PrebuiltChunk, vectorData: number[]): void {
  if (vectorData.length !== DB_CONFIG.DIMENSIONS) {
    throw new Error(`Chunk ${chunk.id} has vector length ${vectorData.length}; expected ${DB_CONFIG.DIMENSIONS}`);
  }

  for (let i = 0; i < vectorData.length; i++) {
    if (!Number.isFinite(vectorData[i])) {
      throw new Error(`Chunk ${chunk.id} has invalid vector value at index ${i}: ${String(vectorData[i])}`);
    }
  }
}

// =============================================================================
// PREBUILT INDEX LOADING
// =============================================================================

/**
 * Fetch the prebuilt index from the server.
 * This is the YAML artifact generated by build-rag.py.
 */
async function fetchPrebuiltIndex(): Promise<PrebuiltIndex> {
  log('Fetching prebuilt index');

  const response = await fetch(DB_CONFIG.INDEX_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch prebuilt index: ${response.status} ${response.statusText}`);
  }

  const yamlText = await response.text();
  log(`Fetched ${yamlText.length} bytes`);

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
    errorLog('YAML parse error', parseError);
    throw new Error(`Failed to parse prebuilt index YAML: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }

  if (!index || typeof index !== 'object') {
    errorLog('Parsed index is not an object', index);
    throw new Error('Failed to parse prebuilt index: invalid YAML structure (got ' + typeof index + ')');
  }

  const prebuiltIndex = index as PrebuiltIndex;

  if (typeof prebuiltIndex.chunk_count !== 'number' || !Array.isArray(prebuiltIndex.chunks)) {
    errorLog('Index missing required fields', { chunk_count: prebuiltIndex.chunk_count, chunks: typeof prebuiltIndex.chunks });
    throw new Error(`Prebuilt index missing required fields: chunk_count=${prebuiltIndex.chunk_count}, chunks=${Array.isArray(prebuiltIndex.chunks)}`);
  }

  log(`Loaded prebuilt index: ${prebuiltIndex.chunk_count} chunks, model: ${prebuiltIndex.model}`);

  return prebuiltIndex;
}

async function ensureDocumentMetadataLoaded(): Promise<void> {
  if (prebuiltIndex) {
    return;
  }

  prebuiltIndex = await fetchPrebuiltIndex();
}

async function isAlreadyLoaded(db: TursoDatabase): Promise<boolean> {
  try {
    const loaded = localStorage.getItem(DB_CONFIG.LOADED_KEY);
    if (!loaded) return false;

    const { version, timestamp } = JSON.parse(loaded);
    // Check version match and index is less than 30 days old
    const isRecent = Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000;
    if (version !== DB_CONFIG.DB_NAME || !isRecent) {
      return false;
    }

    return await getStoredChunkCount(db) > 0;
  } catch {
    return false;
  }
}

function fastHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function computeChunkHash(chunk: PrebuiltChunk): string {
  return chunk.content_hash || fastHash(`${chunk.id}\n${chunk.text}`);
}

function computeManifestHash(index: PrebuiltIndex): string {
  if (index.manifest_hash) {
    return index.manifest_hash;
  }

  return fastHash([
    index.version,
    index.model,
    String(index.dimensions),
    index.metric,
    String(index.chunk_count),
    ...index.chunks.map((chunk) => `${chunk.id}:${computeChunkHash(chunk)}`),
  ].join('\n'));
}

function buildChunkHashes(index: PrebuiltIndex): Record<string, string> {
  const chunkHashes: Record<string, string> = {};
  for (const chunk of index.chunks) {
    chunkHashes[chunk.id] = computeChunkHash(chunk);
  }
  return chunkHashes;
}

function readCacheMeta(): CacheMetadata | null {
  try {
    const raw = localStorage.getItem(DB_CONFIG.CACHE_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheMetadata;
  } catch (error) {
    warn('Failed to read cache metadata', error);
    return null;
  }
}

function writeCacheMeta(meta: CacheMetadata): void {
  try {
    localStorage.setItem(DB_CONFIG.CACHE_META_KEY, JSON.stringify(meta));
  } catch (error) {
    warn('Failed to write cache metadata', error);
  }
}

function clearCacheMeta(): void {
  try {
    localStorage.removeItem(DB_CONFIG.CACHE_META_KEY);
  } catch (error) {
    warn('Failed to clear cache metadata', error);
  }
}

async function hasUsableCachedIndex(db: TursoDatabase, expectedCount: number): Promise<boolean> {
  if (databaseMode === 'memory') {
    log('Cache unavailable because Turso is using the in-memory fallback');
    return false;
  }

  const storedCount = await getStoredChunkCount(db);
  if (storedCount !== expectedCount) {
    log(`Cache count mismatch: stored=${storedCount}, expected=${expectedCount}`);
    return false;
  }

  return storedCount > 0;
}

/**
 * Mark the prebuilt index as loaded in localStorage.
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
    warn('Failed to mark index as loaded', error);
  }
}

async function loadPrebuiltIndex(
  db: TursoDatabase,
  index: PrebuiltIndex,
  progressCallback?: (progress: InitializationProgress) => void
): Promise<void> {
  log('Loading prebuilt index into Turso');
  const startTime = performance.now();

  if (index.chunks.length === 0) {
    warn('No chunks in prebuilt index');
    updateState({ stage: 'complete', progress: 100, isInitializing: false, message: 'No chunks to load' });
    progressCallback?.({ stage: 'complete', progress: 100, total: 0, processed: 0, message: 'No chunks to load' });
    return;
  }

  updateState({ totalChunks: index.chunks.length, processedChunks: 0, stage: 'indexing', message: `Loading ${index.chunks.length} chunks...` });

  const documents = index.chunks.map((chunk, index) => {
    // Support both new format (vector) and old format (embedding)
    const vectorData = chunk.vector || chunk.embedding;
    if (!vectorData) {
      throw new Error(`Chunk ${chunk.id} has neither 'vector' nor 'embedding' field`);
    }
    validateVector(chunk, vectorData);

    return {
      index,
      id: chunk.id,
      text: chunk.text,
      metadata: JSON.stringify(chunk.metadata),
      vector: JSON.stringify(vectorData),
    };
  });

  const insertChunk = db.prepare(`
    INSERT INTO ${DB_CONFIG.CHUNKS_TABLE} (id, text, metadata, embedding)
    VALUES (?, ?, ?, vector32(?))
  `);

  const BATCH_SIZE = 10;
  const totalBatches = Math.ceil(documents.length / BATCH_SIZE);

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const first = batch[0];
    const last = batch[batch.length - 1];
    log(`Starting batch ${batchNum}/${totalBatches}: chunks ${first.index}-${last.index}, ids ${first.id} .. ${last.id}`);

    for (const document of batch) {
      log(`Inserting chunk ${document.index}: ${document.id}`);
      await withTimeout(
        insertChunk.run(document.id, document.text, document.metadata, document.vector),
        10000,
        `Insert chunk ${document.index} (${document.id})`,
      );
    }

    const processed = Math.min(i + batch.length, documents.length);
    const progress = Math.round((processed / documents.length) * 100);

    updateState({ processedChunks: processed, progress, message: `Loading batch ${batchNum}/${totalBatches}...` });

    const message = `Loading batch ${batchNum}/${totalBatches} (${batch.length} chunks)`;
    log(message);

    progressCallback?.({
      stage: 'indexing',
      progress,
      total: documents.length,
      processed,
      message,
    });
  }

  const duration = Math.round(performance.now() - startTime);
  log(`Index loaded: ${documents.length} chunks in ${duration}ms`);

  updateState({ stage: 'complete', progress: 100, isInitializing: false, message: `Loaded ${documents.length} chunks` });
  progressCallback?.({
    stage: 'complete',
    progress: 100,
    total: documents.length,
    processed: documents.length,
    message: `Loaded ${documents.length} chunks in ${duration}ms`,
  });

  markAsLoaded(documents.length);
}

async function incrementalSync(
  db: TursoDatabase,
  index: PrebuiltIndex,
  cachedMeta: CacheMetadata,
  progressCallback?: (progress: InitializationProgress) => void
): Promise<void> {
  log('Starting incremental sync');
  const startTime = performance.now();
  const remoteHashes = buildChunkHashes(index);
  const localHashes = cachedMeta.chunkHashes || {};

  const toDelete = Object.keys(localHashes).filter((id) => !(id in remoteHashes));
  const toUpsert = index.chunks.filter((chunk) => remoteHashes[chunk.id] !== localHashes[chunk.id]);
  const totalWork = toDelete.length + toUpsert.length;

  if (totalWork === 0) {
    log('No incremental changes detected; cache metadata is already current');
    updateState({ stage: 'complete', progress: 100, isInitializing: false, message: 'Cache up to date' });
    progressCallback?.({ stage: 'complete', progress: 100, total: index.chunk_count, processed: index.chunk_count, message: 'Cache up to date' });
    return;
  }

  log(`Incremental sync: ${toDelete.length} deletions, ${toUpsert.length} upserts`);
  updateState({
    totalChunks: index.chunk_count,
    processedChunks: 0,
    stage: 'indexing',
    message: `Syncing ${toDelete.length} deletions and ${toUpsert.length} upserts`,
  });

  let processed = 0;
  const deleteChunk = db.prepare(`DELETE FROM ${DB_CONFIG.CHUNKS_TABLE} WHERE id = ?`);
  const upsertChunk = db.prepare(`
    INSERT OR REPLACE INTO ${DB_CONFIG.CHUNKS_TABLE} (id, text, metadata, embedding)
    VALUES (?, ?, ?, vector32(?))
  `);

  const BATCH_SIZE = 100;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = toDelete.slice(i, i + BATCH_SIZE);
    const deleteBatch = db.transaction(async (ids: string[]) => {
      for (const id of ids) {
        await deleteChunk.run(id);
      }
    });
    await deleteBatch(batch);
    processed += batch.length;
    const progress = Math.round((processed / totalWork) * 100);
    updateState({ processedChunks: processed, progress, message: `Deleting stale chunks (${processed}/${totalWork})...` });
    progressCallback?.({ stage: 'indexing', progress, total: totalWork, processed, message: `Deleting stale chunks (${processed}/${totalWork})...` });
  }

  const upsertBatch = db.transaction(async (batch: PrebuiltChunk[]) => {
    for (const chunk of batch) {
      const vectorData = chunk.vector || chunk.embedding;
      if (!vectorData) {
        throw new Error(`Chunk ${chunk.id} has neither 'vector' nor 'embedding' field`);
      }
      await upsertChunk.run(
        chunk.id,
        chunk.text,
        JSON.stringify(chunk.metadata),
        JSON.stringify(vectorData),
      );
    }
  });

  for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
    const batch = toUpsert.slice(i, i + BATCH_SIZE);
    await upsertBatch(batch);
    processed += batch.length;
    const progress = Math.round((processed / totalWork) * 100);
    updateState({ processedChunks: processed, progress, message: `Upserting chunks (${processed}/${totalWork})...` });
    progressCallback?.({ stage: 'indexing', progress, total: totalWork, processed, message: `Upserting chunks (${processed}/${totalWork})...` });
  }

  const duration = Math.round(performance.now() - startTime);
  log(`Incremental sync complete: ${toDelete.length} deleted, ${toUpsert.length} upserted in ${duration}ms`);
  updateState({ stage: 'complete', progress: 100, isInitializing: false, message: `Synced ${toUpsert.length} chunks in ${duration}ms` });
  progressCallback?.({
    stage: 'complete',
    progress: 100,
    total: index.chunk_count,
    processed: index.chunk_count,
    message: `Synced ${toUpsert.length} chunks in ${duration}ms`,
  });
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Initialize the Prebuilt RAG system.
 * This is called automatically on first use and will:
 * 1. Initialize the VectorDB (with embedding model for queries)
 * 2. Load the prebuilt index (if not already loaded)
 *
 * @param progressCallback - Optional callback for progress updates
 * @returns Promise that resolves when initialization is complete
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
    // If already initializing, just subscribe to state changes
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
    // Unsubscribe when initialization completes
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
      log('Initializing Prebuilt RAG system');

      const loadingMsg = 'Opening Turso Browser RAG database...';
      updateState({ stage: 'loading', progress: 10, message: loadingMsg });
      progressCallback?.({
        stage: 'loading',
        progress: 10,
        total: 0,
        processed: 0,
        message: loadingMsg,
      });

      const db = await getVectorDB();

      const checkingMsg = databaseMode === 'memory'
        ? 'Using in-memory Turso fallback, checking cache...'
        : 'Turso database initialized, checking cache...';
      updateState({ stage: 'loading', progress: 20, message: checkingMsg });
      progressCallback?.({
        stage: 'loading',
        progress: 20,
        total: 0,
        processed: 0,
        message: checkingMsg,
      });

      const fetchingMsg = 'Fetching prebuilt index...';
      updateState({ stage: 'fetching', progress: 30, message: fetchingMsg });
      progressCallback?.({
        stage: 'fetching',
        progress: 30,
        total: 0,
        processed: 0,
        message: fetchingMsg,
      });

      const index = await fetchPrebuiltIndex();
      prebuiltIndex = index;
      const manifestHash = computeManifestHash(index);
      const cachedMeta = readCacheMeta();
      log(`Manifest hash ${manifestHash}; chunks=${index.chunk_count}; dbMode=${databaseMode ?? 'unknown'}`);

      if (
        cachedMeta &&
        cachedMeta.dbName === DB_CONFIG.DB_NAME &&
        cachedMeta.manifestHash === manifestHash &&
        await hasUsableCachedIndex(db, index.chunk_count)
      ) {
        const cachedMsg = `Using cached index (${index.chunk_count} chunks)`;
        log(cachedMsg);
        updateState({ stage: 'complete', progress: 100, isInitializing: false, message: cachedMsg });
        progressCallback?.({
          stage: 'complete',
          progress: 100,
          total: index.chunk_count,
          processed: index.chunk_count,
          message: cachedMsg,
        });
        isInitialized = true;
        log('Initialization complete (cache hit)');
        return;
      }

      if (
        cachedMeta &&
        cachedMeta.dbName === DB_CONFIG.DB_NAME &&
        Object.keys(cachedMeta.chunkHashes || {}).length > 0 &&
        databaseMode !== 'memory'
      ) {
        const syncMsg = 'Manifest changed, performing incremental sync...';
        log(syncMsg);
        updateState({ stage: 'loading', progress: 40, message: syncMsg });
        progressCallback?.({
          stage: 'loading',
          progress: 40,
          total: index.chunk_count,
          processed: 0,
          message: syncMsg,
        });

        await incrementalSync(db, index, cachedMeta, progressCallback);
        writeCacheMeta({
          dbName: DB_CONFIG.DB_NAME,
          manifestHash,
          chunkHashes: buildChunkHashes(index),
          chunkCount: index.chunk_count,
          syncedAt: Date.now(),
        });
        markAsLoaded(index.chunk_count);
        isInitialized = true;
        log('Initialization complete (incremental sync)');
        return;
      }

      const fetchedMsg = `Fetched ${index.chunk_count} chunks, clearing existing data...`;
      updateState({ totalChunks: index.chunk_count, stage: 'loading', progress: 50, message: fetchedMsg });
      progressCallback?.({
        stage: 'loading',
        progress: 50,
        total: index.chunk_count,
        processed: 0,
        message: fetchedMsg,
      });

      await clearDatabase(db);
      await loadPrebuiltIndex(db, index, progressCallback);
      writeCacheMeta({
        dbName: DB_CONFIG.DB_NAME,
        manifestHash,
        chunkHashes: buildChunkHashes(index),
        chunkCount: index.chunk_count,
        syncedAt: Date.now(),
      });

      isInitialized = true;
      log('Initialization complete (full load)');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errorLog('Initialization failed', error);
      updateState({ stage: 'error', isInitializing: false, error: errorMsg, message: `Error: ${errorMsg}` });
      progressCallback?.({
        stage: 'error',
        progress: 0,
        total: 0,
        processed: 0,
        message: `Error: ${errorMsg}`,
      });
      throw error;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Search the documentation for relevant chunks.
 * Returns the top-k most semantically similar chunks to the query.
 *
 * @param query - The search query text
 * @param k - Number of results to return (default: 5)
 * @returns Array of search results with similarity scores
 */
async function search(query: string, k: number = DB_CONFIG.DEFAULT_K): Promise<SearchResult[]> {
  log(`search() called with query="${query}", k=${k}`);
  if (!isInitialized) {
    await initialize();
  }

  const db = await getVectorDB();
  const queryEmbedding = await getQueryEmbedding(query);
  log('Executing vector search');

  const results = await db.prepare(`
    SELECT
      text,
      metadata,
      vector_distance_cos(embedding, vector32(?)) AS distance
    FROM ${DB_CONFIG.CHUNKS_TABLE}
    ORDER BY distance ASC
    LIMIT ?
  `).all(JSON.stringify(queryEmbedding), k) as Array<{
    text: unknown;
    metadata: unknown;
    distance: unknown;
  }>;

  return results.map((result) => {
    const distance = numberFromSqlValue(result.distance);
    const metadata = JSON.parse(String(result.metadata)) as PrebuiltChunk['metadata'];

    return {
      text: String(result.text ?? ''),
      score: Math.max(0, Math.min(1, 1 - distance)),
      metadata,
    };
  });
}

/**
 * Check if the RAG system is initialized and ready.
 * @returns true if ready to accept searches
 */
function checkReady(): boolean {
  return isInitialized;
}

/**
 * Get the total number of indexed chunks.
 * @returns Promise resolving to the index size
 */
async function getIndexSize(): Promise<number> {
  if (!isInitialized) {
    await initialize();
  }
  const db = await getVectorDB();
  return await getStoredChunkCount(db);
}

/**
 * Force reload the prebuilt index.
 * Use this after updating documentation.
 */
async function reload(progressCallback?: (progress: InitializationProgress) => void): Promise<void> {
  log('Starting reload');
  isInitialized = false;
  prebuiltIndex = null;
  updateState({ isInitializing: true, stage: 'fetching', progress: 0, error: null, message: 'Reloading index...' });

  try {
    localStorage.removeItem(DB_CONFIG.LOADED_KEY);
    clearCacheMeta();
    const db = await getVectorDB();
    await clearDatabase(db);
    await initialize(progressCallback);
    log('Reload complete');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errorLog('Reload failed', error);
    updateState({ stage: 'error', isInitializing: false, error: errorMsg, message: `Error: ${errorMsg}` });
    throw error;
  }
}

/**
 * Clear the vector database without reinitializing.
 * Use this when you want to clear the index but not reload immediately.
 * Call reload() afterwards to reindex.
 */
async function clearIndex(): Promise<void> {
  log('Clearing index');
  isInitialized = false;
  prebuiltIndex = null;
  
  try {
    localStorage.removeItem(DB_CONFIG.LOADED_KEY);
    clearCacheMeta();
    const db = await getVectorDB();
    await clearDatabase(db);
    updateState({ isInitializing: false, stage: 'complete', progress: 0, error: null, message: 'Index cleared' });
    log('Index cleared');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errorLog('Clear failed', error);
    updateState({ stage: 'error', isInitializing: false, error: errorMsg, message: `Error: ${errorMsg}` });
    throw error;
  }
}

/**
 * Get the prebuilt index (for document listing).
 * Returns null if not loaded yet.
 */
function getPrebuiltIndex(): PrebuiltIndex | null {
  return prebuiltIndex;
}

/**
 * Get all unique documents from the prebuilt index (YAML metadata).
 * Fetches YAML if not yet in memory so the debug UI can list paths before full DB init.
 *
 * @public
 */
async function getDocuments(): Promise<DebugDocument[]> {
  if (!prebuiltIndex) {
    try {
      prebuiltIndex = await fetchPrebuiltIndex();
    } catch (error) {
      errorLog('Failed to fetch prebuilt index for getDocuments', error);
      return [];
    }
  }

  const docMap = new Map<string, { title: string; path: string; category: string; totalChunks: number }>();

  for (const chunk of prebuiltIndex.chunks) {
    const { path, title, category, totalChunks } = chunk.metadata;

    if (!docMap.has(path)) {
      docMap.set(path, { title, path, category, totalChunks });
    }
  }

  const documents: DebugDocument[] = Array.from(docMap.values()).map((doc) => ({
    id: doc.path,
    title: doc.title,
    path: doc.path,
    category: doc.category,
    chunkCount: doc.totalChunks,
    isAdhoc: false,
  }));

  return documents.sort((a, b) => a.path.localeCompare(b.path));
}

// =============================================================================
// EXPORT
// =============================================================================

/**
 * Turso WASM RAG instance for Paperclip (same engine as VowelDocs `prebuiltRAG`).
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
