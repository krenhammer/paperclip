/**
 * Shared Turso RAG readiness for voice UI and RAG debug chrome.
 *
 * Bootstraps the same pipeline as {@link ../components/turso-rag-debug/react/RAGDebugTool}:
 * `tursoRAG.initialize()` then {@link ../components/turso-rag-debug/chat.warmUpRAG} so query
 * embeddings are loaded before the voice agent answers with RAG.
 *
 * Uses a singleton bootstrap so parallel subscribers (mic button, rail debug button, FAB)
 * share one load. State is broadcast via `useSyncExternalStore`-compatible subscribe/getSnapshot.
 *
 * @module lib/turso-rag-voice-gate
 */

import { useSyncExternalStore } from "react";

/**
 * Snapshot of RAG voice-gate state for UI (mic enablement, loading tint).
 */
export type TursoRagGateSnapshot = {
  /** True after DB init and embedding warm-up succeed */
  ready: boolean;
  /** True while bootstrap is in progress */
  loading: boolean;
  /** Set when initialization fails catastrophically */
  error: string | null;
  /** Approximate progress 0–100 from Turso init */
  progress: number;
};

const serverSnapshot: TursoRagGateSnapshot = {
  ready: false,
  loading: true,
  error: null,
  progress: 0,
};

let snapshot: TursoRagGateSnapshot = { ...serverSnapshot };

const listeners = new Set<() => void>();

let bootstrapPromise: Promise<void> | null = null;

function notify(): void {
  listeners.forEach((fn) => fn());
}

function setSnapshot(next: Partial<TursoRagGateSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  notify();
}

/**
 * Runs Turso init + warm-up once; safe to call from multiple UI surfaces.
 */
function ensureBootstrap(): void {
  if (bootstrapPromise) return;

  bootstrapPromise = (async () => {
    setSnapshot({ loading: true, error: null, ready: false });

    try {
      const mod = await import("@/components/turso-rag-debug/turso-rag");
      let unsub: (() => void) | undefined;

      unsub = mod.subscribeToInitializationState(() => {
        const s = mod.getInitializationState();
        setSnapshot({
          progress: s.progress,
          loading: true,
        });
      });

      try {
        if (!mod.tursoRAG.isReady()) {
          await mod.tursoRAG.initialize();
        }
      } finally {
        unsub?.();
      }

      const { warmUpRAG } = await import("@/components/turso-rag-debug/chat");
      await warmUpRAG();

      setSnapshot({
        ready: true,
        loading: false,
        error: null,
        progress: 100,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSnapshot({
        ready: false,
        loading: false,
        error: msg,
        progress: 0,
      });
    }
  })();
}

/**
 * Subscribe to gate snapshot updates (for `useSyncExternalStore`).
 */
export function subscribeTursoRagGate(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  ensureBootstrap();
  return () => {
    listeners.delete(onStoreChange);
  };
}

/**
 * Current gate snapshot (client).
 */
export function getTursoRagGateSnapshot(): TursoRagGateSnapshot {
  return snapshot;
}

/**
 * Server / SSR snapshot for `useSyncExternalStore`.
 */
export function getTursoRagGateServerSnapshot(): TursoRagGateSnapshot {
  return serverSnapshot;
}

/**
 * React hook: Turso RAG readiness for gating the voice mic and tinting RAG debug controls.
 */
export function useTursoRagVoiceGate(): TursoRagGateSnapshot {
  return useSyncExternalStore(
    subscribeTursoRagGate,
    getTursoRagGateSnapshot,
    getTursoRagGateServerSnapshot,
  );
}
