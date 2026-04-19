

## Assessment: Can the Vowel mic button and config dialog be refactored as plugins?

Based on an analysis of the [plugin documentation](doc/plugins) files and the current Vowel integration code, here's my assessment:

**Short answer: No, not with the current plugin system and exactly the same functionality.** There are architectural mismatches that would require trade-offs.

### Current Vowel Integration Components

The existing implementation consists of three parts:

1. **`PaperclipVoiceButton`** - Global toolbar button showing real-time conversation state (idle/user-speaking/ai-thinking/ai-speaking)
2. **`PaperclipVoiceConfigModal`** - Configuration dialog for hosted/self-hosted Vowel credentials
3. **`vowel.client.ts`** - Vowel client initialization with React Router adapters, custom actions, and conversation state management

### What the Plugin System Supports (Current Alpha)

From `PLUGIN_AUTHORING_GUIDE.md`, the UI mount surfaces include:
- `globalToolbarButton` - ✅ Could host the mic button
- `settingsPage` - ✅ Could host the config dialog (custom settings page slot)

### The Blockers

Here are the fundamental mismatches preventing a clean refactor:

**1. Vowel Client Requires Browser APIs**
The Vowel SDK needs WebSocket, WebRTC/audio, and DOM access. The plugin system runs workers **out-of-process in Node.js** (communicating via JSON-RPC stdio). The Vowel client cannot run in the worker—it needs the browser. This is the biggest architectural mismatch.

**2. Real-time Conversation State**
The mic button displays live state changes (user-speaking → ai-thinking → ai-speaking). The plugin system has:
- `usePluginData` - polled data fetching
- `usePluginStream` - streaming data

Both would add latency and complexity versus the current direct client state subscription.

**3. Synchronous Navigation Requirements**
The current code uses `createReactRouterAdapters` with direct access to React Router's `navigate` function. The plugin UI-to-worker bridge is **async RPC**—navigation would become asynchronous, breaking the voice navigation flow.

**4. Credential Storage Pattern**
The current implementation stores credentials in `localStorage` for the browser-based Vowel client to access. While plugins run same-origin and *could* access localStorage, this bypasses the intended `plugin_config` table and `ctx.config` SDK pattern.

**5. Custom Action Registration**
The Vowel client registers actions like `getAppState`, `navigateTo`, `createIssue`, `createGoal`. These are registered via:
```typescript
vowel.registerAction("createIssue", {...}, async () => {...})
```

In a plugin architecture, actions would need to be:
- Declared in the manifest as agent tools
- Implemented in the **worker** (Node.js process)
- But many actions need UI interaction (opening dialogs, form pre-fill)

This creates a split-brain problem: voice actions that need UI access would have to cross the worker↔UI bridge, adding complexity.

### What Would Work vs. What Wouldn't

| Feature | Current | As Plugin | Feasibility |
|---------|---------|-----------|-------------|
| Config dialog UI | Modal | `settingsPage` slot | ✅ Possible |
| Hosted/Self-hosted tabs | Custom form | Custom settings component | ✅ Possible |
| JWT token parsing | Client-side | Client-side | ✅ Possible |
| Mic button in header | Direct component | `globalToolbarButton` | ⚠️ Partial - missing real-time state updates |
| Conversation state indicator | Direct subscription | `usePluginStream` | ❌ High latency, complex |
| Voice navigation | Synchronous | Async RPC | ❌ Breaks UX |
| Start voice session | Direct client method | Worker bridge | ❌ Audio in worker not supported |

### Conclusion

The Vowel integration is inherently a **browser-native, real-time, UI-coupled feature** that doesn't fit the out-of-process plugin worker model. The plugin system is designed for:
- Data connectors (Linear, GitHub)
- Background jobs
- UI extensions with async data needs

Voice integration requires:
- Real-time audio processing
- Synchronous UI interactions
- Browser-native APIs

**Recommendation**: Keep the Vowel integration as core UI code. If you want pluggable voice providers in the future, consider a **platform module** approach (in-process, trusted) rather than the general plugin system, or extend the plugin system with a "browser-native plugin" category that runs in the main thread with full DOM access.