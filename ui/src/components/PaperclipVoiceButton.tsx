/**
 * PaperclipVoice Configuration Button
 *
 * Shows a button to configure voice when no environment-based
 * VOWEL_APP_ID is set. Opens the configuration modal when clicked.
 * Displays different icons based on AI conversation state.
 *
 * @module components/PaperclipVoiceButton
 */

import { useState, useEffect, useCallback } from "react";
import { Mic, Settings } from "lucide-react";
import { BsStars } from "react-icons/bs";
import { LuBrain, LuMessageSquare } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PaperclipVoiceConfigModal,
  hasVoiceConfig,
  getVoiceConfig,
  type StoredVoiceCredentials,
} from "./PaperclipVoiceConfigModal";
import {
  subscribeToConversationState,
  type ConversationState,
} from "@/vowel.client";
import { cn } from "@/lib/utils";

/**
 * Props for the PaperclipVoiceButton component
 */
interface PaperclipVoiceButtonProps {
  /** Optional additional CSS classes */
  className?: string;
  /** Size variant for the button */
  size?: "sm" | "md" | "lg";
  /** Callback when voice is configured */
  onConfigured?: (credentials: StoredVoiceCredentials) => void;
  /** Callback when voice config is cleared */
  onCleared?: () => void;
  /** Callback when user clicks "Start Session" after configuring */
  onStartSession?: () => void;
  /** Whether to show conversation state icons (only works when voice is active) */
  showConversationState?: boolean;
}

/**
 * Get the icon component and tooltip text for a conversation state
 */
function getStateDisplay(
  state: ConversationState,
  size: number
): { icon: React.ReactNode; tooltip: string } {
  switch (state) {
    case "user-speaking":
      return {
        icon: <LuMessageSquare size={size} aria-hidden="true" />,
        tooltip: "You are speaking...",
      };
    case "ai-thinking":
      return {
        icon: <LuBrain size={size} aria-hidden="true" />,
        tooltip: "AI is thinking...",
      };
    case "ai-speaking":
      return {
        icon: <BsStars size={size} aria-hidden="true" />,
        tooltip: "AI is speaking...",
      };
    default:
      return {
        icon: <Mic size={size} aria-hidden="true" />,
        tooltip: "Voice active - click to reconfigure",
      };
  }
}

/**
 * Button to configure PaperclipVoice when no env config exists.
 * Shows configuration status and opens the config modal.
 *
 * @example
 * ```tsx
 * <PaperclipVoiceButton size="md" onConfigured={(creds) => initializeVoice(creds)} />
 * ```
 */
export function PaperclipVoiceButton({
  className,
  size = "md",
  onConfigured,
  onCleared,
  onStartSession,
  showConversationState = true,
}: PaperclipVoiceButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>("idle");

  // Check for stored config on mount
  useEffect(() => {
    setHasConfig(hasVoiceConfig());
  }, []);

  // Subscribe to conversation state changes
  useEffect(() => {
    if (!showConversationState || !hasConfig) return;
    return subscribeToConversationState(setConversationState);
  }, [showConversationState, hasConfig]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "paperclip-voice-config") {
        setHasConfig(hasVoiceConfig());
        if (!event.newValue && onCleared) {
          onCleared();
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [onCleared]);

  const handleConfigured = useCallback(
    (credentials: StoredVoiceCredentials) => {
      setHasConfig(true);
      onConfigured?.(credentials);
    },
    [onConfigured]
  );

  const handleCleared = useCallback(() => {
    setHasConfig(false);
    onCleared?.();
  }, [onCleared]);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  // Get the appropriate icon and tooltip based on conversation state
  const { icon: stateIcon, tooltip: stateTooltip } = hasConfig && showConversationState
    ? getStateDisplay(conversationState, iconSizes[size])
    : { icon: <Mic size={iconSizes[size]} aria-hidden="true" />, tooltip: "" };

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={hasConfig ? "default" : "outline"}
              size="icon"
              onClick={() => setModalOpen(true)}
              className={cn(
                "relative transition-all duration-200",
                hasConfig &&
                  "bg-primary text-primary-foreground hover:bg-primary/90 border-primary",
                !hasConfig &&
                  "border-dashed border-primary/50 text-primary hover:border-primary hover:bg-primary/10",
                sizeClasses[size],
                className
              )}
              aria-label={
                hasConfig
                  ? stateTooltip || "Voice configured - click to reconfigure"
                  : "Configure voice navigation"
              }
            >
              {stateIcon}

              {/* Settings indicator when not configured */}
              {!hasConfig && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
              )}

              {/* Status indicator dot when configured */}
              {hasConfig && (
                <span
                  className={cn(
                    "absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-background bg-green-500"
                  )}
                  aria-hidden="true"
                />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center">
            <p className="text-xs">
              {!hasConfig
                ? "Configure PaperclipVoice for hands-free navigation"
                : showConversationState && stateTooltip
                  ? stateTooltip
                  : "PaperclipVoice configured - click to reconfigure"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PaperclipVoiceConfigModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onConfigured={handleConfigured}
        onCleared={handleCleared}
        onStartSession={onStartSession}
        isSessionActive={conversationState !== "idle"}
      />
    </>
  );
}

/**
 * Full version of the button with status text.
 * Useful for prominent placement in sidebars or panels.
 */
export function PaperclipVoiceButtonFull({
  className,
  size = "md",
  onConfigured,
  onCleared,
  onStartSession,
  showConversationState = true,
}: Omit<PaperclipVoiceButtonProps, "size"> & { size?: "sm" | "md" }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>("idle");

  useEffect(() => {
    setHasConfig(hasVoiceConfig());
  }, []);

  // Subscribe to conversation state changes
  useEffect(() => {
    if (!showConversationState || !hasConfig) return;
    return subscribeToConversationState(setConversationState);
  }, [showConversationState, hasConfig]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "paperclip-voice-config") {
        setHasConfig(hasVoiceConfig());
        if (!event.newValue && onCleared) {
          onCleared();
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [onCleared]);

  const handleConfigured = useCallback(
    (credentials: StoredVoiceCredentials) => {
      setHasConfig(true);
      onConfigured?.(credentials);
    },
    [onConfigured]
  );

  const handleCleared = useCallback(() => {
    setHasConfig(false);
    onCleared?.();
  }, [onCleared]);

  // Get the appropriate icon based on conversation state
  const { icon: stateIcon } = hasConfig && showConversationState
    ? getStateDisplay(conversationState, size === "sm" ? 14 : 18)
    : { icon: <Mic size={size === "sm" ? 14 : 18} aria-hidden="true" /> };

  // Get label based on state
  const getButtonLabel = () => {
    if (!hasConfig) return "Enable PaperclipVoice";
    switch (conversationState) {
      case "user-speaking":
        return "Listening...";
      case "ai-thinking":
        return "Thinking...";
      case "ai-speaking":
        return "Speaking...";
      default:
        return "PaperclipVoice Active";
    }
  };

  return (
    <>
      <Button
        variant={hasConfig ? "default" : "outline"}
        onClick={() => setModalOpen(true)}
        className={cn(
          "gap-2 transition-all duration-200",
          hasConfig &&
            "bg-primary text-primary-foreground hover:bg-primary/90 border-primary",
          !hasConfig &&
            "border-dashed border-primary/50 text-primary hover:border-primary hover:bg-primary/10",
          className
        )}
      >
        {stateIcon}
        <span className="text-sm">{getButtonLabel()}</span>
        {!hasConfig && (
          <span className="ml-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
        )}
      </Button>

      <PaperclipVoiceConfigModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onConfigured={handleConfigured}
        onCleared={handleCleared}
        onStartSession={onStartSession}
        isSessionActive={conversationState !== "idle"}
      />
    </>
  );
}
