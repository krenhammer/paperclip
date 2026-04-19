/**
 * @module turso-rag-debug/types
 *
 * Type definitions for the Turso Browser RAG debug tool.
 *
 * Provides type-safe interfaces for documents, chat messages, and search results
 * when using Turso's in-browser vector search capabilities.
 *
 * @packageDocumentation
 */

/**
 * Represents a pre-built document chunk with embedding and metadata
 * Loaded from rag-index.yml
 */
export interface PrebuiltChunk {
  /** Unique identifier for the chunk */
  id: string;
  /** The text content of the chunk (with context prefix) */
  text: string;
  /** 384-dimensional embedding vector */
  vector?: number[];
  /** 384-dimensional embedding vector @deprecated Use 'vector' instead */
  embedding?: number[];
  /** Metadata about the chunk */
  metadata: {
    /** Document title from frontmatter */
    title: string;
    /** Full file path */
    path: string;
    /** URL-friendly path */
    urlPath: string;
    /** Category/folder name */
    category: string;
    /** Chunk index within the document */
    chunkIndex: number;
    /** Total chunks for this document */
    totalChunks: number;
  };
}

/**
 * Prebuilt index structure from rag-index.yml
 */
export interface PrebuiltIndex {
  version: string;
  model: string;
  dimensions: number;
  metric: string;
  chunk_count: number;
  chunks: PrebuiltChunk[];
}

/**
 * Document entry from rag-documents.yml
 */
export interface DocumentEntry {
  title: string;
  description?: string;
  category?: string;
  url_path: string;
  content: string;
  word_count?: number;
  char_count?: number;
}

/**
 * Documents manifest structure from rag-documents.yml
 */
export interface DocumentsManifest {
  version: string;
  document_count: number;
  documents: Record<string, DocumentEntry>;
}

/**
 * Search result from the Turso vector database
 */
export interface SearchResult {
  /** The document chunk text */
  text: string;
  /** Similarity score (0-1, higher is better) */
  score: number;
  /** Document metadata */
  metadata: PrebuiltChunk['metadata'];
}

/**
 * Represents a document entry in the debug view
 *
 * @public
 */
export interface DebugDocument {
  /** Unique document identifier */
  id: string;
  /** Display title */
  title: string;
  /** File path */
  path: string;
  /** Document category */
  category: string;
  /** Number of chunks the document is split into */
  chunkCount: number;
  /** Whether this is a user-added adhoc document */
  isAdhoc: boolean;
}

/**
 * Chat message roles
 *
 * @public
 */
export type ChatRole = 'user' | 'assistant' | 'system';

/**
 * Chat message in the debug interface
 *
 * @public
 */
export interface ChatMessage {
  /** Message role */
  role: ChatRole;
  /** Message content */
  content: string;
  /** Unix timestamp */
  timestamp: number;
  /** Optional search results attached to the message */
  results?: SearchResult[];
}

/**
 * Current state of the debug tool
 *
 * @public
 */
export interface DebugState {
  /** Whether the dialog is currently open */
  isOpen: boolean;
  /** Currently active tab */
  activeTab: 'documents' | 'chat';
  /** List of documents currently in the index */
  documents: DebugDocument[];
  /** Chat message history */
  chatMessages: ChatMessage[];
  /** Whether a loading operation is in progress */
  isLoading: boolean;
}

/**
 * Folder node for the document tree view
 *
 * @public
 */
export interface FolderNode {
  /** Folder name */
  name: string;
  /** Full path */
  path: string;
  /** Child folders */
  children: Map<string, FolderNode>;
  /** Files in this folder */
  files: DebugDocument[];
}

/**
 * Adhoc document stored in localStorage
 *
 * @public
 */
export interface AdhocDocument {
  /** Unique identifier */
  id: string;
  /** Document title */
  title: string;
  /** Virtual file path */
  path: string;
  /** Document content */
  content: string;
}

/**
 * Progress callback for initialization
 */
export interface InitializationProgress {
  /** Current stage of initialization */
  stage: 'fetching' | 'loading' | 'indexing' | 'complete' | 'error';
  /** Progress percentage (0-100) */
  progress: number;
  /** Total number of chunks to process */
  total: number;
  /** Number of chunks processed so far */
  processed: number;
  /** Human-readable status message */
  message: string;
}

/**
 * RAG initialization and search interface
 */
export interface TursoRAG {
  /** Initialize the RAG system (loads prebuilt index into Turso) */
  initialize(progressCallback?: (progress: InitializationProgress) => void): Promise<void>;
  /** Search for relevant documentation */
  search(query: string, k?: number): Promise<SearchResult[]>;
  /** Check if the database is ready */
  isReady(): boolean;
  /** Get total number of indexed chunks */
  getIndexSize(): Promise<number>;
  /** Force reload the prebuilt index */
  reload(progressCallback?: (progress: InitializationProgress) => void): Promise<void>;
  /** Clear the vector database without reinitializing. Call reload() to reindex. */
  clearIndex(): Promise<void>;
  /** Get all unique documents from the prebuilt index */
  getDocuments(): DebugDocument[];
}
