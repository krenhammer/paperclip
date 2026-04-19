/**
 * Vowel voice agent RAG (Retrieval-Augmented Generation) actions
 *
 * This module provides voice-accessible RAG actions for the Paperclip voice assistant.
 * These actions allow users to:
 * - Search the knowledge base for documentation and information
 * - Ask questions about Paperclip and get RAG-powered answers
 * - Open the RAG debug chat to see search results
 *
 * The RAG system uses Turso WASM for in-browser vector search with pre-built embeddings
 * from the documentation, enabling privacy-first, zero-cloud-cost semantic search.
 *
 * @module vowel.rag-actions
 */

import type { Vowel } from "@vowel.to/client";
import type { SearchResult } from "./components/turso-rag-debug/types";

/** Reference to the RAG debug UI state */
let ragDebugState: {
  isOpen: boolean;
  openChat?: (initialQuery?: string, results?: SearchResult[]) => void;
} = { isOpen: false };

/**
 * Register RAG debug UI functions
 * Called by the TursoRagDebug component when mounted
 */
export function registerRagDebugFunctions(functions: {
  openChat: (initialQuery?: string, results?: SearchResult[]) => void;
}): void {
  ragDebugState.openChat = functions.openChat;
}

/**
 * Check if RAG debug chat is available
 */
export function isRagDebugAvailable(): boolean {
  return !!ragDebugState.openChat;
}

/**
 * Lazy-loaded Turso RAG module
 */
let tursoRAGModule: typeof import("./components/turso-rag-debug/turso-rag") | null = null;

/**
 * Get or load the Turso RAG module
 */
async function getTursoRAG() {
  if (!tursoRAGModule) {
    tursoRAGModule = await import("./components/turso-rag-debug/turso-rag");
  }
  return tursoRAGModule;
}

/**
 * Search the knowledge base for relevant documentation
 */
async function searchKnowledgeBase(
  query: string,
  k: number = 5
): Promise<SearchResult[]> {
  const { tursoRAG } = await getTursoRAG();

  // Ensure RAG is initialized
  if (!tursoRAG.isReady()) {
    await tursoRAG.initialize();
  }

  return await tursoRAG.search(query, k);
}

/**
 * Register RAG actions for the Vowel voice agent
 *
 * @param vowel - The Vowel client instance
 */
export function registerRAGActions(vowel: Vowel): void {
  /**
   * Search the Paperclip knowledge base for documentation and information.
   * Use this when the user asks questions about how Paperclip works,
   * its features, idioms, or any documentation-related queries.
   */
  vowel.registerAction(
    "searchKnowledgeBase",
    {
      description:
        "Search the Paperclip documentation knowledge base for relevant information. Use this when users ask questions about how Paperclip works, its features, idioms, or documentation. Returns relevant documentation chunks with source paths.",
      parameters: {
        query: {
          type: "string",
          description:
            "The search query about Paperclip - can be a question or keywords (e.g., 'how do agents work', 'what is a routine', 'explain the checkout process')",
        },
        k: {
          type: "number",
          description: "Number of results to return (default: 5, max: 10)",
        },
      },
    },
    async ({ query, k = 5 }: { query: string; k?: number }) => {
      try {
        console.log("[RAG] Searching knowledge base:", query);
        const results = await searchKnowledgeBase(query, Math.min(k, 10));

        // Format results for the AI
        const formattedResults = results.map((r, i) => ({
          rank: i + 1,
          text: r.text.substring(0, 500), // Truncate long texts
          source: r.metadata.path,
          title: r.metadata.title,
          category: r.metadata.category,
          relevance: Math.round((1 - r.score) * 100), // Convert distance to relevance %
        }));

        console.log(`[RAG] Found ${results.length} results`);

        return {
          success: true,
          query,
          resultCount: results.length,
          results: formattedResults,
          summary: results
            .map(
              (r, i) =>
                `[${i + 1}] From "${r.metadata.title}" (${r.metadata.path}): ${r.text.substring(0, 200)}...`
            )
            .join("\n\n"),
        };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        console.error("[RAG] Search failed:", error);
        return {
          success: false,
          error: errorMsg,
          query,
          results: [],
        };
      }
    }
  );

  /**
   * Open the RAG debug chat to show search results and transcripts.
   * Users can say "open debug chat" or "show me the search results".
   */
  vowel.registerAction(
    "openRagDebugChat",
    {
      description:
        "Open the RAG debug chat panel to show search results and voice transcripts. Use this when users want to see what the AI retrieved from the knowledge base or when debugging RAG issues.",
      parameters: {
        query: {
          type: "string",
          description:
            "Optional query to pre-populate in the debug chat (e.g., the last search query)",
        },
      },
    },
    async ({ query }: { query?: string }) => {
      if (ragDebugState.openChat) {
        // If query provided, search first then open with results
        if (query) {
          const results = await searchKnowledgeBase(query, 5);
          ragDebugState.openChat(query, results);
          return {
            success: true,
            message: "Opened RAG debug chat with search results",
            query,
            resultCount: results.length,
          };
        }

        ragDebugState.openChat();
        return {
          success: true,
          message: "Opened RAG debug chat",
        };
      }

      return {
        success: false,
        error:
          "RAG debug chat not available - ensure the Turso RAG debug button is rendered",
      };
    }
  );

  /**
   * Get the status of the RAG knowledge base
   */
  vowel.registerAction(
    "getKnowledgeBaseStatus",
    {
      description:
        "Get the current status of the RAG knowledge base - number of indexed documents, initialization status, and database info.",
      parameters: {},
    },
    async () => {
      try {
        const { tursoRAG, getInitializationState } = await getTursoRAG();
        const state = getInitializationState();
        const isReady = tursoRAG.isReady();
        const size = isReady ? await tursoRAG.getIndexSize() : 0;
        const documents = await tursoRAG.getDocuments();

        return {
          success: true,
          isReady,
          isInitializing: state.isInitializing,
          progress: state.progress,
          stage: state.stage,
          indexedChunks: size,
          documentCount: documents.length,
          documents: documents.slice(0, 10).map((d) => ({
            title: d.title,
            path: d.path,
            category: d.category,
            chunkCount: d.chunkCount,
          })),
          message: isReady
            ? `Knowledge base ready with ${size} chunks from ${documents.length} documents`
            : `Knowledge base ${state.isInitializing ? "initializing" : "not loaded"}: ${state.message}`,
        };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: errorMsg,
          isReady: false,
        };
      }
    }
  );
}
