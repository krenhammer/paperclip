/**
 * PaperclipVoice Header Button
 *
 * Simple configuration button for the header toolbar.
 * Always opens the config modal when clicked.
 * Voice session control is handled by the FAB in the bottom right.
 *
 * @module components/PaperclipVoiceHeaderButton
 */

import { useState, useEffect, useCallback } from "react";
import { Mic, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  PaperclipVoiceConfigModal,
  hasVoiceConfig,
  type StoredVoiceCredentials,
} from "./PaperclipVoiceConfigModal";
import {
  initFromStoredConfig,
  cleanupVoiceAgent,
  getVowel,
  getVoiceConfig,
} from "../vowel.client";
import { cn } from "@/lib/utils";

/**
 * Header button that always opens the voice configuration modal.
 * Does not control voice session - that's handled by the FAB.
 */
export function PaperclipVoiceHeaderButton() {
  const [modalOpen, setModalOpen] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check for config on mount (both env and localStorage)
  useEffect(() => {
    const envAppId = import.meta.env.VITE_VOWEL_APP_ID;
    const localConfig = hasVoiceConfig();
    setHasConfig(!!envAppId || localConfig);
    setIsInitialized(true);
  }, []);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "paperclip-voice-config") {
        const envAppId = import.meta.env.VITE_VOWEL_APP_ID;
        const localConfig = hasVoiceConfig();
        setHasConfig(!!envAppId || localConfig);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleConfigured = useCallback((credentials: StoredVoiceCredentials) => {
    setHasConfig(true);
    // Initialize the voice client with the new credentials
    initFromStoredConfig(credentials);
  }, []);

  const handleCleared = useCallback(() => {
    setHasConfig(false);
    cleanupVoiceAgent();
  }, []);

  const handleStartSession = useCallback(() => {
    let vowel = getVowel();
    // Initialize if needed (e.g., right after saving credentials)
    if (!vowel) {
      const config = getVoiceConfig();
      if (config) {
        initFromStoredConfig(config);
        vowel = getVowel();
      }
    }
    if (vowel) {
      vowel.startSession();
    }
  }, []);

  // If not initialized yet, show nothing to avoid flash
  if (!isInitialized) {
    return null;
  }

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={hasConfig ? "default" : "outline"}
                  size="sm"
                  onClick={() => setModalOpen(true)}
                  className={cn(
                    "relative gap-2 px-3 h-8",
                    "transition-all duration-300 ease-out",
                    hasConfig
                      ? [
                          "bg-primary text-primary-foreground hover:bg-primary/90",
                          "shadow-lg shadow-primary/25",
                          "ring-2 ring-[#6366f1]/50 ring-offset-2 ring-offset-background",
                        ]
                      : [
                          "bg-background/80 backdrop-blur-sm",
                          "border border-border/80",
                          "text-foreground/90 hover:text-foreground",
                          "hover:bg-accent hover:border-accent",
                          "animate-subtle-glow",
                        ]
                  )}
                  aria-label="Configure PaperclipVoice"
                >
                  <Mic size={16} aria-hidden="true" className={cn(hasConfig && "text-primary-foreground")} />
                  <span className="text-sm font-medium">PaperclipVoice</span>
                  <span className="text-sm text-muted-foreground">|</span>
                  <span className={cn("text-sm", hasConfig ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    vowel
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center">
                <p className="text-xs">
                  {hasConfig
                    ? "Voice configured - click to change settings"
                    : "Configure voice navigation"}
                </p>
              </TooltipContent>
            </Tooltip>
          </HoverCardTrigger>
          <HoverCardContent
            side="bottom"
            align="center"
            className="w-80 p-4"
            sideOffset={8}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  hasConfig ? "bg-primary/10" : "bg-muted/10"
                )}>
                  <Mic className={cn("h-4 w-4", hasConfig ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">PaperclipVoice</h4>
                  <p className="text-xs text-muted-foreground">Powered by vowel.to</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {hasConfig
                  ? "Voice is configured. Use the microphone button in the bottom right to start a voice session."
                  : "Navigate Paperclip using voice commands. Configure your vowel.to credentials to get started."}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info size={12} />
                <span>
                  {hasConfig
                    ? "Click to change settings or remove configuration"
                    : "Requires a vowel.to API key"}
                </span>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </TooltipProvider>

      <PaperclipVoiceConfigModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onConfigured={handleConfigured}
        onCleared={handleCleared}
        onStartSession={handleStartSession}
      />
    </>
  );
}
