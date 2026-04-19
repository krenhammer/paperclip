/**
 * Headless bootstrap for the Vowel client when credentials live in localStorage.
 *
 * Mount once near the app root (alongside env-based init from `main.tsx` via `VITE_VOWEL_APP_ID`).
 * Does not render UI. Schedules initialization after the first paint so the shell can load
 * without waiting on the optional voice stack; the client appears when ready via
 * `subscribeToVowelChanges` in `vowel.client`.
 *
 * @module components/VoiceControlInit
 */

import { useEffect } from "react";
import {
  cleanupVoiceAgent,
  getVoiceConfig,
  getVowel,
  hasVoiceConfig,
  initFromStoredConfig,
} from "../vowel.client";

const VOICE_CONFIG_STORAGE_KEY = "paperclip-voice-config";

/**
 * Attempts to create the Vowel client from `paperclip-voice-config` if needed.
 * No-ops when a client already exists (e.g. env init won first) or storage is empty/invalid.
 */
function tryInitFromStoredConfig(): void {
  if (typeof window === "undefined") return;
  if (getVowel()) return;
  if (!hasVoiceConfig()) return;

  const config = getVoiceConfig();
  if (!config) return;

  console.log("🎤 VoiceControlInit: initializing from stored config");
  initFromStoredConfig(config);
}

/**
 * Headless component: deferred localStorage voice init + cross-tab sync.
 * Renders nothing.
 */
export function VoiceControlInit() {
  useEffect(() => {
    /**
     * Defer work until the browser is idle (or soon after first paint via timeout fallback)
     * so routing, layout, and queries are not contending with voice client construction.
     */
    const run = () => {
      tryInitFromStoredConfig();
    };

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof window.setTimeout> | undefined;

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(run, { timeout: 3000 });
    } else {
      timeoutId = window.setTimeout(run, 0);
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== VOICE_CONFIG_STORAGE_KEY) return;

      if (!event.newValue) {
        cleanupVoiceAgent();
        return;
      }

      const envAppId = import.meta.env.VITE_VOWEL_APP_ID;
      const localOk = hasVoiceConfig();
      if (!(envAppId || localOk)) return;
      if (!getVowel()) {
        tryInitFromStoredConfig();
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      if (idleId !== undefined && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
