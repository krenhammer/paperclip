/**
 * PaperclipVoice Configuration Modal
 *
 * Provides a modal interface for configuring Vowel voice agent credentials.
 * Supports both hosted (SaaS) and self-hosted configurations.
 * Credentials are stored in localStorage.
 *
 * @module components/PaperclipVoiceConfigModal
 */

import { useState, useEffect, useCallback } from "react";
import { Mic, Eye, EyeOff, X, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Configuration modes for voice agent
 */
type ConfigMode = "hosted" | "selfhosted";

/**
 * Stored credentials format
 */
export interface StoredVoiceCredentials {
  mode: ConfigMode;
  hosted?: {
    appId: string;
  };
  selfHosted?: {
    appId?: string;
    url?: string;
    jwt?: string;
  };
  timestamp: number;
}

/**
 * Props for the PaperclipVoiceConfigModal component
 */
interface PaperclipVoiceConfigModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when configuration is saved */
  onConfigured?: (credentials: StoredVoiceCredentials) => void;
  /** Callback when configuration is cleared */
  onCleared?: () => void;
  /** Callback when user clicks "Start Session" after configuring */
  onStartSession?: () => void;
}

const STORAGE_KEY = "paperclip-voice-config";

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
    const hasSelfHostedAppUrl = !!(config.selfHosted?.appId && config.selfHosted?.url);
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
 * Configuration modal for PaperclipVoice voice agent.
 * Allows users to enter credentials for hosted or self-hosted Vowel instances.
 */
export function PaperclipVoiceConfigModal({
  open,
  onOpenChange,
  onConfigured,
  onCleared,
  onStartSession,
}: PaperclipVoiceConfigModalProps) {
  const [mode, setMode] = useState<ConfigMode>("hosted");
  const [hostedAppId, setHostedAppId] = useState("");
  const [selfHostedAppId, setSelfHostedAppId] = useState("");
  const [selfHostedUrl, setSelfHostedUrl] = useState("");
  const [selfHostedJwt, setSelfHostedJwt] = useState("");
  const [showHostedAppId, setShowHostedAppId] = useState(false);
  const [showSelfHostedAppId, setShowSelfHostedAppId] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [hasStoredConfig, setHasStoredConfig] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Reset justSaved when modal opens/closes
  useEffect(() => {
    if (!open) {
      setJustSaved(false);
    }
  }, [open]);

  // Load stored config on mount
  useEffect(() => {
    if (!open) return;

    const stored = getVoiceConfig();
    if (stored) {
      setHasStoredConfig(true);
      setMode(stored.mode);
      if (stored.mode === "hosted" && stored.hosted) {
        setHostedAppId(stored.hosted.appId || "");
      } else if (stored.mode === "selfhosted" && stored.selfHosted) {
        if (stored.selfHosted.jwt) {
          setSelfHostedJwt(stored.selfHosted.jwt);
        } else {
          setSelfHostedAppId(stored.selfHosted.appId || "");
          setSelfHostedUrl(stored.selfHosted.url || "");
        }
      }
    }
  }, [open]);

  // Clear messages when mode changes
  useEffect(() => {
    setErrorMessage("");
    setSuccessMessage("");
  }, [mode]);

  const handleSaveHosted = useCallback(() => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!hostedAppId.trim()) {
      setErrorMessage("Please provide an App ID");
      return;
    }

    const credentials: StoredVoiceCredentials = {
      mode: "hosted",
      hosted: { appId: hostedAppId.trim() },
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
      setHasStoredConfig(true);
      setJustSaved(true);
      setSuccessMessage("Configuration saved! Click 'Start Session' to begin.");
      onConfigured?.(credentials);
    } catch (error) {
      setErrorMessage("Failed to save configuration. Storage may be disabled.");
      console.error("Error saving config:", error);
    }
  }, [hostedAppId, onConfigured]);

  const handleSaveSelfHosted = useCallback(() => {
    setErrorMessage("");
    setSuccessMessage("");

    const useJwt = import.meta.env.VITE_VOWEL_USE_JWT === "true";

    if (useJwt) {
      const jwt = selfHostedJwt.trim();
      if (!jwt || !jwt.includes(".") || jwt.split(".").length !== 3) {
        setErrorMessage("Please provide a valid JWT token");
        return;
      }

      const credentials: StoredVoiceCredentials = {
        mode: "selfhosted",
        selfHosted: { jwt },
        timestamp: Date.now(),
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
        setHasStoredConfig(true);
        setJustSaved(true);
        setSuccessMessage("Configuration saved! Click 'Start Session' to begin.");
        onConfigured?.(credentials);
      } catch (error) {
        setErrorMessage("Failed to save configuration. Storage may be disabled.");
        console.error("Error saving config:", error);
      }
    } else {
      if (!selfHostedAppId.trim() || !selfHostedUrl.trim()) {
        setErrorMessage("Please provide both App ID and Realtime URL");
        return;
      }

      const credentials: StoredVoiceCredentials = {
        mode: "selfhosted",
        selfHosted: {
          appId: selfHostedAppId.trim(),
          url: selfHostedUrl.trim(),
        },
        timestamp: Date.now(),
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
        setHasStoredConfig(true);
        setJustSaved(true);
        setSuccessMessage("Configuration saved! Click 'Start Session' to begin.");
        onConfigured?.(credentials);
      } catch (error) {
        setErrorMessage("Failed to save configuration. Storage may be disabled.");
        console.error("Error saving config:", error);
      }
    }
  }, [selfHostedAppId, selfHostedUrl, selfHostedJwt, onConfigured]);

  const handleClearConfig = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setHasStoredConfig(false);
      setHostedAppId("");
      setSelfHostedAppId("");
      setSelfHostedUrl("");
      setSelfHostedJwt("");
      setSuccessMessage("Configuration cleared. Voice agent disabled.");
      onCleared?.();
      setShowConfirmClear(false);

      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (error) {
      console.error("Error clearing config:", error);
    }
  }, [onCleared, onOpenChange]);

  // Extract URL from JWT for display
  const extractedJwtUrl = (() => {
    if (!selfHostedJwt) return null;
    try {
      const parts = selfHostedJwt.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload.url || payload.endpoint || payload.rtu || null;
    } catch {
      return null;
    }
  })();

  const useJwtFromEnv = import.meta.env.VITE_VOWEL_USE_JWT === "true";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Configure PaperclipVoice
          </DialogTitle>
          <DialogDescription>
            Enter your vowel credentials to enable voice navigation. Get credentials from{" "}
            <a
              href="https://vowel.to"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              vowel.to
            </a>{" "}
            (SaaS) or your{" "}
            <a
              href="https://docs.vowel.to/self-hosted"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              self-hosted
            </a>{" "}
            instance.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as ConfigMode)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="hosted">Hosted (SaaS)</TabsTrigger>
            <TabsTrigger value="selfhosted">Self-Hosted</TabsTrigger>
          </TabsList>

          {/* Hosted Mode Form */}
          <div className={cn("mt-4 space-y-4", mode !== "hosted" && "hidden")}>
            <div className="space-y-2">
              <Label htmlFor="hosted-app-id">App ID</Label>
              <div className="relative">
                <Input
                  id="hosted-app-id"
                  type={showHostedAppId ? "text" : "password"}
                  placeholder="your-app-id"
                  value={hostedAppId}
                  onChange={(e) => setHostedAppId(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowHostedAppId(!showHostedAppId)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showHostedAppId ? "Hide App ID" : "Show App ID"}
                >
                  {showHostedAppId ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your vowel application ID from{" "}
                <a
                  href="https://vowel.to"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  vowel.to
                </a>
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSaveHosted}
                disabled={!hostedAppId.trim()}
                className="flex-1"
              >
                Save & Enable PaperclipVoice
              </Button>
              {hasStoredConfig && mode === "hosted" && (
                <Button
                  variant="destructive"
                  onClick={() => setShowConfirmClear(true)}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>

          {/* Self-Hosted Mode Form */}
          <div className={cn("mt-4 space-y-4", mode !== "selfhosted" && "hidden")}>
            {useJwtFromEnv ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="jwt-token">JWT Token</Label>
                  <textarea
                    id="jwt-token"
                    rows={3}
                    placeholder="eyJhbGciOiJIUzI1NiIs..."
                    value={selfHostedJwt}
                    onChange={(e) => setSelfHostedJwt(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">
                    Server-signed JWT token. URL is auto-detected from the JWT payload.
                  </p>
                </div>

                {extractedJwtUrl && (
                  <div className="space-y-2">
                    <Label>Detected Realtime URL</Label>
                    <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono text-muted-foreground">
                      <code>{extractedJwtUrl}</code>
                    </div>
                    <p className="text-xs text-muted-foreground">Extracted from JWT payload</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="selfhosted-app-id">App ID</Label>
                  <div className="relative">
                    <Input
                      id="selfhosted-app-id"
                      type={showSelfHostedAppId ? "text" : "password"}
                      placeholder="your-app-id"
                      value={selfHostedAppId}
                      onChange={(e) => setSelfHostedAppId(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSelfHostedAppId(!showSelfHostedAppId)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                      aria-label={showSelfHostedAppId ? "Hide App ID" : "Show App ID"}
                    >
                      {showSelfHostedAppId ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Your self-hosted application ID</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="selfhosted-url">Realtime URL</Label>
                  <Input
                    id="selfhosted-url"
                    type="text"
                    placeholder="wss://your-instance.com/realtime"
                    value={selfHostedUrl}
                    onChange={(e) => setSelfHostedUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Your self-hosted realtime endpoint</p>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSaveSelfHosted}
                disabled={
                  useJwtFromEnv
                    ? !selfHostedJwt.trim() ||
                      !selfHostedJwt.includes(".") ||
                      selfHostedJwt.split(".").length !== 3
                    : !selfHostedAppId.trim() || !selfHostedUrl.trim()
                }
                className="flex-1"
              >
                Save & Enable PaperclipVoice
              </Button>
              {hasStoredConfig && mode === "selfhosted" && (
                <Button
                  variant="destructive"
                  onClick={() => setShowConfirmClear(true)}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </Tabs>

        {/* Error Message */}
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Start Session button - shown after saving credentials */}
        {justSaved && (
          <Button
            onClick={() => {
              onStartSession?.();
              onOpenChange(false);
            }}
            className="w-full gap-2"
          >
            <Mic className="h-4 w-4" />
            Start Session
          </Button>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {hasStoredConfig && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmClear(true)}
            >
              Clear Saved Config
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            Credentials are stored locally in your browser.
          </span>
        </DialogFooter>
      </DialogContent>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmClear} onOpenChange={setShowConfirmClear}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove your saved configuration? This will clear the stored
              credentials from local storage.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowConfirmClear(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearConfig}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
