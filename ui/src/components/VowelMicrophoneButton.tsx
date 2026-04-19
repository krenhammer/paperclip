/**
 * Vowel Microphone Button Component
 *
 * Provides a voice interaction button for the Vowel AI assistant.
 * Shows the current connection state and allows starting/stopping voice sessions.
 *
 * @module components/VowelMicrophoneButton
 */

import { useVowel } from "@vowel.to/client/react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Props for the VowelMicrophoneButton component
 */
interface VowelMicrophoneButtonProps {
  /** Optional additional CSS classes */
  className?: string;
  /** Size variant for the button */
  size?: "sm" | "md" | "lg";
  /** Whether to show the status text alongside the icon */
  showStatus?: boolean;
}

/**
 * Microphone button for voice interaction with the Vowel AI assistant.
 *
 * Displays different states based on connection status:
 * - Disconnected: Shows microphone icon, ready to start session
 * - Connecting: Shows loading spinner
 * - Connected: Shows active microphone with status indicators
 *
 * @example
 * ```tsx
 * <VowelMicrophoneButton size="md" showStatus />
 * ```
 */
export function VowelMicrophoneButton({
  className,
  size = "md",
  showStatus = false,
}: VowelMicrophoneButtonProps) {
  const { state, toggleSession } = useVowel();

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

  /**
   * Get the tooltip text based on current state
   */
  const getTooltipText = () => {
    if (state.isConnecting) return "Connecting to voice assistant...";
    if (state.isConnected) {
      if (state.isUserSpeaking) return "Listening... (click to stop)";
      if (state.isAISpeaking) return "AI is speaking... (click to stop)";
      return "Voice session active (click to stop)";
    }
    return "Start voice assistant";
  };

  /**
   * Get the status text for display
   */
  const getStatusText = () => {
    if (state.isConnecting) return "Connecting...";
    if (state.isConnected) {
      if (state.isUserSpeaking) return "Listening...";
      if (state.isAISpeaking) return "Speaking...";
      return "Connected";
    }
    return "Voice";
  };

  /**
   * Get the button variant based on state
   */
  const getButtonVariant = (): "default" | "secondary" | "destructive" | "outline" | "ghost" | "link" => {
    if (state.isConnected) return "default";
    return "outline";
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={getButtonVariant()}
            size={showStatus ? "default" : "icon"}
            onClick={toggleSession}
            disabled={state.isConnecting}
            className={cn(
              "relative transition-all duration-200",
              state.isConnected && "bg-primary text-primary-foreground hover:bg-primary/90",
              state.isUserSpeaking && "ring-2 ring-green-500 ring-offset-2",
              state.isAISpeaking && "ring-2 ring-blue-500 ring-offset-2",
              !showStatus && sizeClasses[size],
              className,
            )}
            aria-label={getTooltipText()}
          >
            {state.isConnecting ? (
              <Loader2
                size={iconSizes[size]}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : state.isConnected ? (
              <Mic size={iconSizes[size]} aria-hidden="true" />
            ) : (
              <MicOff size={iconSizes[size]} aria-hidden="true" />
            )}

            {showStatus && (
              <span className="ml-2 text-sm">{getStatusText()}</span>
            )}

            {/* Status indicator dot */}
            {state.isConnected && !showStatus && (
              <span
                className={cn(
                  "absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
                  state.isUserSpeaking && "bg-green-500 animate-pulse",
                  state.isAISpeaking && "bg-blue-500",
                  !state.isUserSpeaking && !state.isAISpeaking && "bg-primary",
                )}
                aria-hidden="true"
              />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center">
          <p className="text-xs">{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact version of the microphone button with just an icon.
 * Useful for toolbar or header placement.
 */
export function VowelMicrophoneButtonCompact({
  className,
  size = "sm",
}: Omit<VowelMicrophoneButtonProps, "showStatus">) {
  return <VowelMicrophoneButton className={className} size={size} showStatus={false} />;
}

/**
 * Full version of the microphone button with status text.
 * Useful for prominent placement in sidebars or panels.
 */
export function VowelMicrophoneButtonFull({
  className,
  size = "md",
}: Omit<VowelMicrophoneButtonProps, "showStatus">) {
  return <VowelMicrophoneButton className={className} size={size} showStatus={true} />;
}
