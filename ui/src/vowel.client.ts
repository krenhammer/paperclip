/**
 * Vowel voice agent client initialization
 *
 * This module provides the Vowel client setup with React Router adapters.
 * It uses context-ready initialization to ensure stores are loaded before client init.
 *
 * @module vowel.client
 */

import { Vowel, createReactRouterAdapters } from "@vowel.to/client";
import type { NavigateFunction, Location } from "react-router-dom";

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
 * Create a new Vowel client instance with the given app ID.
 *
 * @param appId - The Vowel app ID from vowel.to platform
 * @returns Configured Vowel client instance
 */
function createVowelClient(appId: string): Vowel {
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

  const vowel = new Vowel({
    appId: appId,

    instructions: `You are a helpful voice assistant for Paperclip, an AI agent control plane.

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

Help users navigate the Paperclip control plane and understand their AI agents, projects, and tasks.`,

    navigationAdapter,
    // Automation adapter is disabled by default - uncomment only if user explicitly enables it
    // automationAdapter,
    floatingCursor: { enabled: false },

    borderGlow: {
      enabled: true,
      color: "rgba(99, 102, 241, 0.5)",
      intensity: 30,
      pulse: true,
    },

    // Enable captions by default for accessibility
    // @ts-ignore - internal caption config may not be fully typed in all builds
    _caption: {
      enabled: true,
      position: "top-center",
      maxWidth: "600px",
      showRole: true,
      showOnMobile: false,
    },

    _voiceConfig: {
      provider: "vowel-prime",
      vowelPrimeConfig: { environment: "staging" },
      llmProvider: "groq",
      model: "openai/gpt-oss-120b",
      voice: "Timothy",
      language: "en-US",
      initialGreetingPrompt: `Welcome to Paperclip! I'm your voice assistant for the AI agent control plane. You can ask me to navigate to different pages like "go to agents" or "show me projects", or ask for help understanding what's available. What would you like to do?`,
    },

    onUserSpeakingChange: (isSpeaking) => {
      console.log(isSpeaking ? "🗣️ User started speaking" : "🔇 User stopped speaking");
    },
    onAIThinkingChange: (isThinking) => {
      console.log(isThinking ? "🧠 AI started thinking" : "💭 AI stopped thinking");
    },
    onAISpeakingChange: (isSpeaking) => {
      console.log(isSpeaking ? "🔊 AI started speaking" : "🔇 AI stopped speaking");
    },
  });

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
    },
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
          description: "The path to navigate to (e.g., '/agents', '/projects', '/dashboard')",
        },
      },
    },
    async ({ path }: { path: string }) => {
      if (navigateFn) {
        navigateFn(path);
        return { success: true, message: `Navigated to ${path}` };
      }
      return { success: false, error: "Navigation not available" };
    },
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
  vowelInstance = createVowelClient(appId);
  console.log("✅ Vowel client initialized with App ID:", appId);
  vowelChangeListeners.forEach((listener) => listener(vowelInstance));
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
export function subscribeToVowelChanges(listener: VowelChangeListener): () => void {
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
