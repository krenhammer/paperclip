/**
 * PaperclipVoice Configuration Button
 *
 * Shows a button to configure voice when no environment-based
 * VOWEL_APP_ID is set. Opens the configuration modal when clicked.
 *
 * @module components/PaperclipVoiceButton
 */

import { useState, useEffect, useCallback } from "react";
import { Mic, Settings } from "lucide-react";
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
}: PaperclipVoiceButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);

  // Check for stored config on mount
  useEffect(() => {
    setHasConfig(hasVoiceConfig());
  }, []);

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
                  ? "Voice configured - click to reconfigure"
                  : "Configure voice navigation"
              }
            >
              <Mic size={iconSizes[size]} aria-hidden="true" />

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
              {hasConfig
                ? "PaperclipVoice configured - click to reconfigure"
                : "Configure PaperclipVoice for hands-free navigation"}
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
}: Omit<PaperclipVoiceButtonProps, "size"> & { size?: "sm" | "md" }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);

  useEffect(() => {
    setHasConfig(hasVoiceConfig());
  }, []);

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
        <Mic size={size === "sm" ? 14 : 18} aria-hidden="true" />
        <span className="text-sm">
          {hasConfig ? "PaperclipVoice Active" : "Enable PaperclipVoice"}
        </span>
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
      />
    </>
  );
}
