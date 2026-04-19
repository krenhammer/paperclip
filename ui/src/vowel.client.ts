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

/** Individual state flags for computing overall state */
let isUserSpeakingFlag = false;
let isAIThinkingFlag = false;
let isAISpeakingFlag = false;

/**
 * Compute the overall conversation state based on individual flags.
 * Priority: user-speaking > ai-speaking > ai-thinking > idle
 */
function computeConversationState(): ConversationState {
  if (isUserSpeakingFlag) return "user-speaking";
  if (isAISpeakingFlag) return "ai-speaking";
  if (isAIThinkingFlag) return "ai-thinking";
  return "idle";
}

/**
 * Update the conversation state and notify listeners if changed.
 * This is called after any state flag changes.
 */
function updateConversationState() {
  const newState = computeConversationState();
  if (newState !== currentConversationState) {
    currentConversationState = newState;
    stateChangeListeners.forEach((listener) => listener(newState));
  }
}

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

## CRITICAL: Work Through the UI
**⚠️ MOST IMPORTANT RULE**: When creating or modifying data, always work through the UI dialogs/forms, NOT direct API calls. This lets users see and verify values before submitting. Actions open dialogs with pre-filled values - users can edit and then confirm.

## CRITICAL: Always Refer to Context for Information
Before answering ANY question or performing ANY action, ALWAYS check the <context> section for current information. The context contains the most up-to-date state of the application.

## CRITICAL: Use searchKnowledgeBase for Paperclip product questions
**⚠️ REQUIRED**: Whenever the user asks what Paperclip is, what it does, how it works, what it is for, or any question about Paperclip's purpose, features, behavior, or documentation — call **searchKnowledgeBase** first, then answer from the retrieved chunks. Do not answer those questions from general knowledge alone. This includes "what is paperclip", "what does paperclip do", "explain paperclip", "how does paperclip work", and similar. Use <context> for live app state (current route, company, etc.); use searchKnowledgeBase for factual product and docs answers.

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

### Knowledge Base (RAG-Powered Documentation Search):
- searchKnowledgeBase: Search the Paperclip documentation for answers. **Always call this** when the user asks what Paperclip is, what it does, or how it works (product/docs). Also use for features, idioms, and any documentation-style question. Search first, then answer only from retrieved context (plus <context> for live UI state when relevant).
- getKnowledgeBaseStatus: Check if the knowledge base is ready and how many documents are indexed.
- openRagDebugChat: Open the debug panel to see search results and voice transcripts. Users can say "open debug chat" or "show search results".

### Company Management (READ-ONLY):
- getCompanySynopsis: Get comprehensive company overview (agents, tasks, costs, approvals). Call for "company status", "overview", "how is my company doing".
- listCompanies: List all accessible companies. Call for "list companies", "show my companies".
- getCompany: Get detailed company info. Call for "company details", "tell me about this company".
- createCompany: Create a new company directly. Call for "create company", "add company", "new company".

### Creating via UI Dialogs (SHOWS UI FOR USER VERIFICATION):
- createIssue: Opens New Issue dialog with pre-filled values. Call for "create issue", "add task", "new issue". Values are shown in the dialog for user to verify before submitting.
- createGoal: Opens New Goal dialog with pre-filled values. Call for "create goal", "set objective", "new goal". Values are shown in the dialog for user to verify before submitting.
- createProject: Opens New Project dialog. Call for "create project", "new project".
- createAgent: Opens New Agent dialog. Call for "create agent", "new agent", "hire agent".

### Dialog Control:
- submitDialog: Confirm/submit the currently open dialog. Call when user says "submit", "create it", "confirm", "save it" after filling in a dialog.
- cancelDialog: Cancel/close the current dialog without saving. Call when user says "cancel", "close", "never mind".

## Voice Workflow Examples:
**Creating an issue:**
1. User: "Create issue: Fix the login bug"
2. AI calls createIssue with title="Fix the login bug"
3. AI responds: "Opened issue dialog with title. Say 'submit' when ready."
4. User sees the dialog with pre-filled title, can add more details
5. User: "Submit"
6. AI responds: "Press Enter or click Create to submit."

**Multiple fields:**
1. User: "Create goal: Launch v2, target December 31st"
2. AI calls createGoal with title="Launch v2", targetDate="2024-12-31"
3. AI responds: "Opened goal dialog with title, target date. Say 'submit' when ready."

**Cancel:**
1. User: "Cancel"
2. AI calls cancelDialog
3. AI responds: "Cancelled issue creation."

**Asking about Paperclip (RAG-powered):**
1. User: "What is Paperclip?" or "How do routines work?"
2. AI calls searchKnowledgeBase with query="What is Paperclip?" or "how do routines work"
3. AI receives relevant documentation chunks
4. AI responds with answer based on retrieved context: "Paperclip is an AI agent control plane..."
5. User: "Show me where that came from" or "Open debug chat"
6. AI calls openRagDebugChat to show the search results

## How to Use:
- To navigate: Say "go to [page]" or "show me [page]"
- Questions about Paperclip itself (what it is/does): Call searchKnowledgeBase, then answer briefly from results.
- To get company status: Say "company synopsis", "how is my company doing"
- To create items via UI: Say "create issue", "add goal", "new project" - values appear in dialog for verification
- To submit dialog: Say "submit", "create it", "confirm"
- To cancel dialog: Say "cancel", "close", "never mind"
- **DO NOT use DOM manipulation** - use registered actions only

Help users navigate the Paperclip control plane, view summaries via voice, and create items through UI dialogs.`;

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
      isUserSpeakingFlag = isSpeaking;
      updateConversationState();
    },
    onAIThinkingChange: (isThinking: boolean) => {
      console.log(
        isThinking ? "🧠 AI started thinking" : "💭 AI stopped thinking"
      );
      isAIThinkingFlag = isThinking;
      updateConversationState();
    },
    onAISpeakingChange: (isSpeaking: boolean) => {
      console.log(
        isSpeaking ? "🔊 AI started speaking" : "🔇 AI stopped speaking"
      );
      isAISpeakingFlag = isSpeaking;
      updateConversationState();
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

import {
  registerCompanyActions,
  setVoiceCurrentCompanyId,
} from "./vowel.company-actions";
import { registerUIActions } from "./vowel.ui-actions";
import { registerRAGActions } from "./vowel.rag-actions";

// Re-export voice action utilities for external integration
export { setVoiceCurrentCompanyId };

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

  // Register voice actions
  // Company actions (getters) - API-based for reading data
  registerCompanyActions(vowel);
  // UI actions (creates) - open dialogs so users can verify before submitting
  registerUIActions(vowel);
  // RAG actions - knowledge base search for documentation queries
  registerRAGActions(vowel);
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
    // Reset all state flags
    isUserSpeakingFlag = false;
    isAIThinkingFlag = false;
    isAISpeakingFlag = false;
    updateConversationState();
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
