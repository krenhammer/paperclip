/**
 * Vowel voice agent client initialization
 *
 * This module provides the Vowel client setup with React Router adapters.
 * It uses context-ready initialization to ensure stores are loaded before client init.
 * Supports both environment-based and localStorage-based configuration.
 *
 * @module vowel.client
 */

import { Vowel, createReactRouterAdapters } from "@vowel.to/client";
import type { NavigateFunction, Location } from "react-router-dom";
import type { StoredVoiceCredentials } from "./components/PaperclipVoiceConfigModal";

/** Vowel client instance - null until initialized */
let vowelInstance: Vowel | null = null;

/** Current app ID - null until setAppId is called */
let currentAppId: string | null = null;

/** Navigation function from React Router - set by adapter */
let navigateFn: NavigateFunction | null = null;

/** Current location - updated on route changes */
let currentLocation: Location | null = null;

/** Callback type for vowel client change listeners */
type VowelChangeListener = (client: Vowel | null) => void;

/** Set of listeners for vowel client changes */
const vowelChangeListeners = new Set<VowelChangeListener>();

/** Conversation state type */
export type ConversationState =
  | "idle"           // Waiting for input, microphone active
  | "user-speaking"  // User is speaking
  | "ai-thinking"    // AI is processing/thinking
  | "ai-speaking";   // AI is talking

/** Callback type for conversation state change listeners */
type StateChangeListener = (state: ConversationState) => void;

/** Set of listeners for conversation state changes */
const stateChangeListeners = new Set<StateChangeListener>();

/** Current conversation state */
let currentConversationState: ConversationState = "idle";

/**
 * Get the current conversation state
 */
export function getConversationState(): ConversationState {
  return currentConversationState;
}

/**
 * Subscribe to conversation state changes
 */
export function subscribeToConversationState(
  listener: StateChangeListener
): () => void {
  stateChangeListeners.add(listener);
  // Sync with current state immediately
  listener(currentConversationState);
  return () => stateChangeListeners.delete(listener);
}

/**
 * Update the conversation state and notify listeners
 */
function setConversationState(state: ConversationState) {
  if (state !== currentConversationState) {
    currentConversationState = state;
    stateChangeListeners.forEach((listener) => listener(state));
  }
}

/** Storage key for voice configuration */
const STORAGE_KEY = "paperclip-voice-config";

/** SaaS realtime URL - can be overridden via env var */
const HOSTED_REALTIME_URL =
  import.meta.env.VITE_VOWEL_URL || "wss://realtime.vowel.to/v1";

/**
 * Configuration modes for voice agent
 */
type ConfigMode = "hosted" | "selfhosted";

/**
 * Check if voice configuration exists in localStorage
 */
export function hasVoiceConfig(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const config: StoredVoiceCredentials = JSON.parse(stored);
    const hasHosted = !!config.hosted?.appId;
    const hasSelfHostedJwt = !!config.selfHosted?.jwt;
    const hasSelfHostedAppUrl = !!(
      config.selfHosted?.appId && config.selfHosted?.url
    );
    return hasHosted || hasSelfHostedJwt || hasSelfHostedAppUrl;
  } catch {
    return false;
  }
}

/**
 * Get stored voice configuration from localStorage
 */
export function getVoiceConfig(): StoredVoiceCredentials | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    return JSON.parse(stored) as StoredVoiceCredentials;
  } catch (error) {
    console.error("Error reading voice config:", error);
    return null;
  }
}

/**
 * Clear stored voice configuration
 */
export function clearVoiceConfig(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Error clearing voice config:", error);
  }
}

/**
 * Extract realtime URL from JWT payload (JWRT format)
 * JWT may contain url, endpoint, or rtu claim
 */
function extractUrlFromJwt(jwt: string): string | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload.url || payload.endpoint || payload.rtu || null;
  } catch {
    return null;
  }
}

/**
 * Get self-hosted realtime URL: JWT claim > env var > fallback
 */
function getSelfHostedUrl(jwt?: string): string {
  // 1. Try to extract from JWT (JWRT format)
  if (jwt) {
    const jwtUrl = extractUrlFromJwt(jwt);
    if (jwtUrl) {
      console.log("📡 Using realtime URL from JWT:", jwtUrl);
      return jwtUrl;
    }
  }

  // 2. Fall back to environment variable
  const envUrl = import.meta.env.VITE_VOWEL_URL;
  if (envUrl) {
    console.log("📡 Using realtime URL from env:", envUrl);
    return envUrl;
  }

  // 3. Final fallback
  const fallbackUrl = "wss://your-selfhosted-instance.com/realtime";
  console.warn("⚠️ No URL found in JWT or env, using fallback:", fallbackUrl);
  return fallbackUrl;
}

/**
 * Build context for the Vowel AI based on current application state.
 * This is called to provide context about the current route and app state.
 *
 * @returns Context object with current route and app state information
 */
function buildVowelContext() {
  return {
    route: {
      pathname: currentLocation?.pathname || "/",
      pathnameLabel: getPathnameLabel(currentLocation?.pathname || "/"),
      search: String(currentLocation?.search || ""),
    },
  };
}

/**
 * Get a human-readable label for the current pathname.
 *
 * @param pathname - The current URL pathname
 * @returns Human-readable label for the route
 */
function getPathnameLabel(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "Dashboard";

  const routeName = parts[parts.length - 1];
  return routeName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Configuration options for creating a Vowel client
 */
interface VowelClientConfig {
  /** The Vowel app ID (for hosted mode) */
  appId?: string;
  /** JWT token (for self-hosted mode with JWT auth) */
  token?: string;
  /** Realtime API URL (for self-hosted mode) */
  realtimeApiUrl?: string;
}

/**
 * System instructions for the Paperclip voice assistant
 */
const SYSTEM_INSTRUCTIONS = `You are a helpful voice assistant for Paperclip, an AI agent control plane.

## CRITICAL: Be Terse
**⚠️ RESPONSE STYLE**: Be very terse and direct. Never say phrases like "I have opened...", "Let me know...", "I can help you...", or "Is there anything else...". Just state facts and complete actions without conversational filler. Use single words or short phrases when possible.

## CRITICAL: Write to App Store, Not DOM
**⚠️ MOST IMPORTANT RULE**: When performing actions, you MUST write to the application store/state management system, NOT manipulate the DOM directly. Always use registered actions that modify the app store. The UI will automatically update to reflect state changes.

## CRITICAL: Always Refer to Context for Information
Before answering ANY question or performing ANY action, ALWAYS check the <context> section for current information. The context contains the most up-to-date state of the application.

## Current Application State:
The current state is automatically provided in the <context> section. You always have access to the latest state - no need to call any actions to read it.

## Available Routes:
- Dashboard (/): Overview and company dashboard
- Companies (/companies): Manage companies
- Agents (/agents): View and manage AI agents
- Projects (/projects): Project management
- Issues (/issues): Issue tracking
- Routines (/routines): Scheduled tasks
- Goals (/goals): Company goals
- Approvals (/approvals): Approval requests
- Costs (/costs): Cost tracking
- Activity (/activity): Activity feed
- Inbox (/inbox): Notifications and messages
- Settings (/instance/settings): Instance settings

## Available Actions:
### Navigation:
Navigation is handled automatically by the navigation adapter. Users can say "go to dashboard", "show me agents", "open projects", etc.

### App State:
- getAppState: Get current route and basic app state. CALL THIS FIRST when starting a new session (initial greeting) - context may not be populated yet.

## How to Use:
- To navigate: Say "go to [page]" or "show me [page]" - e.g., "go to agents", "show me the dashboard"
- To get help: Ask about what you can do in the current page
- **DO NOT use DOM manipulation** - use navigation adapter or registered actions

Help users navigate the Paperclip control plane and understand their AI agents, projects, and tasks.`;

/**
 * Voice configuration for the Paperclip assistant
 */
const VOICE_CONFIG = {
  provider: "vowel-prime" as const,
  vowelPrimeConfig: { environment: "staging" as const },
  llmProvider: "groq" as const,
  model: "openai/gpt-oss-120b",
  voice: "Timothy",
  language: "en-US",
  initialGreetingPrompt: `welcome to paperclip voice how can I help`,
};

/**
 * Create a new Vowel client instance with the given configuration.
 *
 * @param config - Configuration object containing appId, token, or URL
 * @returns Configured Vowel client instance
 */
function createVowelClient(config: VowelClientConfig): Vowel {
  const { appId, token, realtimeApiUrl } = config;

  // Create adapters inside the factory to avoid initialization order issues
  const { navigationAdapter } = createReactRouterAdapters({
    enableAutomation: false, // Disabled by default - only enable if user explicitly requests DOM automation
    navigate: (to: string | number) => {
      if (navigateFn && typeof to === "string") {
        navigateFn(to);
      }
    },
    location: currentLocation || {
      pathname: "/",
      search: "",
      hash: "",
      state: null,
      key: "default",
    },
  });

  // Determine the connection parameters
  const isHosted = !!appId && !token;
  const effectiveRealtimeUrl = isHosted
    ? HOSTED_REALTIME_URL
    : realtimeApiUrl || getSelfHostedUrl(token);

  // Build base config - use any for flexibility with internal properties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vowelConfig: any = {
    instructions: SYSTEM_INSTRUCTIONS,
    navigationAdapter,
    floatingCursor: { enabled: false },
    borderGlow: {
      enabled: true,
      color: "rgba(99, 102, 241, 0.5)",
      intensity: 30,
      pulse: true,
    },
    _caption: {
      enabled: true,
      position: "top-center",
      maxWidth: "600px",
      showRole: true,
      showOnMobile: false,
    },
    _voiceConfig: VOICE_CONFIG,
    turnDetection: {
      mode: "server_vad",
    },
    onUserSpeakingChange: (isSpeaking: boolean) => {
      console.log(
        isSpeaking ? "🗣️ User started speaking" : "🔇 User stopped speaking"
      );
      setConversationState(isSpeaking ? "user-speaking" : "idle");
    },
    onAIThinkingChange: (isThinking: boolean) => {
      console.log(
        isThinking ? "🧠 AI started thinking" : "💭 AI stopped thinking"
      );
      if (isThinking) {
        setConversationState("ai-thinking");
      }
      // When thinking stops, the state will transition to ai-speaking or idle
    },
    onAISpeakingChange: (isSpeaking: boolean) => {
      console.log(
        isSpeaking ? "🔊 AI started speaking" : "🔇 AI stopped speaking"
      );
      setConversationState(isSpeaking ? "ai-speaking" : "idle");
    },
  };

  // Add authentication config based on mode
  if (token) {
    // Self-hosted with JWT
    vowelConfig.token = token;
    vowelConfig.realtimeApiUrl = effectiveRealtimeUrl;
  } else if (appId) {
    // Hosted (SaaS) with App ID
    vowelConfig.appId = appId;
    vowelConfig.realtimeApiUrl = effectiveRealtimeUrl;
  }

  // Create the Vowel client
  const vowel = new Vowel(vowelConfig);

  // Register custom actions
  registerCustomActions(vowel);

  // Push initial context so AI has state immediately
  vowel.updateContext(buildVowelContext());

  return vowel;
}

/**
 * Register custom actions for the Vowel voice agent.
 * All actions must be registered BEFORE startSession() is called.
 *
 * @param vowel - The Vowel client instance
 */
function registerCustomActions(vowel: Vowel) {
  /**
   * Get current app state including route information.
   * Call this FIRST for initial greeting - context may not be synced yet.
   */
  vowel.registerAction(
    "getAppState",
    {
      description:
        "Get current route and app state. CALL THIS FIRST when starting a new session (initial greeting) - context may not be populated yet.",
      parameters: {},
    },
    async () => {
      const state = buildVowelContext();
      return { success: true, ...state };
    }
  );

  /**
   * Navigate to a specific route by name.
   * This is a backup action in case the navigation adapter doesn't handle a specific case.
   */
  vowel.registerAction(
    "navigateTo",
    {
      description: "Navigate to a specific page by path",
      parameters: {
        path: {
          type: "string",
          description:
            "The path to navigate to (e.g., '/agents', '/projects', '/dashboard')",
        },
      },
    },
    async ({ path }: { path: string }) => {
      if (navigateFn) {
        navigateFn(path);
        return { success: true, message: `Navigated to ${path}` };
      }
      return { success: false, error: "Navigation not available" };
    }
  );
}

/**
 * Set the Vowel app ID and initialize the client.
 * Call this from useEffect after App mounts, not at module load.
 *
 * @param appId - The Vowel app ID from vowel.to platform
 */
export function setAppId(appId: string) {
  if (!appId) return;
  currentAppId = appId;
  vowelInstance = createVowelClient({ appId });
  console.log("✅ Vowel client initialized with App ID:", appId);
  vowelChangeListeners.forEach((listener) => listener(vowelInstance));
}

/**
 * Initialize the Vowel client from stored credentials.
 * Call this when credentials are saved via the configuration modal.
 *
 * @param credentials - StoredVoiceCredentials from localStorage
 * @returns true if initialization succeeded
 */
export function initFromStoredConfig(
  credentials: StoredVoiceCredentials
): boolean {
  if (typeof window === "undefined") return false;

  // Don't reinitialize if already initialized
  if (vowelInstance) {
    console.log("🎤 Voice agent already initialized");
    return true;
  }

  try {
    let config: VowelClientConfig = {};

    if (credentials.mode === "hosted" && credentials.hosted?.appId) {
      // Hosted mode
      config = {
        appId: credentials.hosted.appId,
      };
      console.log("🎤 Initializing voice agent in hosted mode");
    } else if (
      credentials.mode === "selfhosted" &&
      credentials.selfHosted
    ) {
      // Self-hosted mode
      if (credentials.selfHosted.jwt) {
        // JWT mode
        config = {
          token: credentials.selfHosted.jwt,
        };
        console.log("🎤 Initializing voice agent in self-hosted JWT mode");
      } else if (
        credentials.selfHosted.appId &&
        credentials.selfHosted.url
      ) {
        // AppId + URL mode
        config = {
          appId: credentials.selfHosted.appId,
          realtimeApiUrl: credentials.selfHosted.url,
        };
        console.log(
          "🎤 Initializing voice agent in self-hosted AppId+URL mode"
        );
      }
    }

    if (!config.appId && !config.token) {
      console.warn("⚠️ Invalid credentials configuration");
      return false;
    }

    // Create the client
    vowelInstance = createVowelClient(config);
    console.log("✅ Voice agent initialized from stored configuration");
    vowelChangeListeners.forEach((listener) => listener(vowelInstance));

    return true;
  } catch (error) {
    console.error("❌ Failed to initialize voice agent from stored config:", error);
    return false;
  }
}

/**
 * Cleanup the voice agent instance
 */
export function cleanupVoiceAgent(): void {
  if (vowelInstance) {
    console.log("🧹 Cleaning up voice agent");
    vowelInstance.stopSession();
    vowelInstance = null;
    vowelChangeListeners.forEach((listener) => listener(null));
    setConversationState("idle");
  }
}

/**
 * Get the current Vowel client instance.
 *
 * @returns The Vowel client or null if not initialized
 */
export function getVowel(): Vowel | null {
  return vowelInstance;
}

/**
 * Subscribe to Vowel client changes.
 * The listener is called immediately if a client already exists.
 *
 * @param listener - Callback function called when client changes
 * @returns Unsubscribe function
 */
export function subscribeToVowelChanges(
  listener: VowelChangeListener
): () => void {
  vowelChangeListeners.add(listener);
  // Sync with current client immediately - handles race condition
  if (vowelInstance) {
    listener(vowelInstance);
  }
  return () => vowelChangeListeners.delete(listener);
}

/**
 * Update the navigation function from React Router.
 * Called by the integration component when router context is available.
 *
 * @param navigate - React Router navigate function
 */
export function setNavigateFunction(navigate: NavigateFunction) {
  navigateFn = navigate;
}

/**
 * Update the current location from React Router.
 * Called on route changes to keep context in sync.
 *
 * @param location - React Router location object
 */
export function setCurrentLocation(location: Location) {
  currentLocation = location;
  // Update context if client exists
  if (vowelInstance) {
    vowelInstance.updateContext(buildVowelContext());
  }
}

/** Type export for Vowel client */
export type VowelClientType = Vowel | null;
