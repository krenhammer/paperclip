import * as React from "react";
import { StrictMode, useEffect, useState } from "react";
import * as ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation, useNavigate } from "@/lib/router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VowelProvider } from "@vowel.to/client/react";
import { App } from "./App";
import { CompanyProvider } from "./context/CompanyContext";
import { LiveUpdatesProvider } from "./context/LiveUpdatesProvider";
import { BreadcrumbProvider } from "./context/BreadcrumbContext";
import { PanelProvider } from "./context/PanelContext";
import { SidebarProvider } from "./context/SidebarContext";
import { DialogProvider } from "./context/DialogContext";
import { EditorAutocompleteProvider } from "./context/EditorAutocompleteContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initPluginBridge } from "./plugins/bridge-init";
import { PluginLauncherProvider } from "./plugins/launchers";
import { VoiceControlInit } from "./components/VoiceControlInit";
import {
  getVowel,
  setAppId,
  subscribeToVowelChanges,
  setNavigateFunction,
  setCurrentLocation,
  type VowelClientType,
} from "./vowel.client";
import "@mdxeditor/editor/style.css";
import "./index.css";

initPluginBridge(React, ReactDOM);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}

/**
 * Hook to initialize Vowel client after app mounts.
 * Call setAppId from useEffect, not at module load, to ensure context is ready.
 */
function useVowelInit() {
  useEffect(() => {
    const appId = import.meta.env.VITE_VOWEL_APP_ID;
    if (appId) {
      setAppId(appId);
    }
  }, []);
}

/**
 * Component that initializes Vowel.
 * Must be mounted outside any loading gate so initialization runs on mount.
 */
function VowelInit() {
  useVowelInit();
  return null;
}

/**
 * Component that syncs React Router state with Vowel context.
 * Must be inside BrowserRouter to access useNavigate and useLocation.
 */
function VowelRouterSync() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setNavigateFunction(navigate);
  }, [navigate]);

  useEffect(() => {
    setCurrentLocation(location);
  }, [location]);

  return null;
}

/**
 * Main app content with optional Vowel provider.
 * Renders the app immediately; voice is initialized asynchronously (`VowelInit` for env,
 * `VoiceControlInit` for localStorage). When a client appears, we wrap with `VowelProvider`.
 */
function AppWithVowel() {
  const [vowel, setVowel] = useState<VowelClientType>(getVowel());

  useEffect(() => {
    const unsubscribe = subscribeToVowelChanges((client) => {
      setVowel(client);
    });
    return unsubscribe;
  }, []);

  // If no vowel client exists yet, render without provider (voice may load moments later)
  if (!vowel) {
    return (
      <>
        <VowelRouterSync />
        <App />
      </>
    );
  }

  // Always wrap with VowelProvider when a vowel client exists
  return (
    <VowelProvider client={vowel}>
      <VowelRouterSync />
      <App />
    </VowelProvider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          {/* VowelInit runs outside any loading gate - required for context-ready initialization */}
          <VowelInit />
          <VoiceControlInit />
          <CompanyProvider>
            <EditorAutocompleteProvider>
              <ToastProvider>
                <LiveUpdatesProvider>
                  <TooltipProvider>
                    <BreadcrumbProvider>
                      <SidebarProvider>
                        <PanelProvider>
                          <PluginLauncherProvider>
                            <DialogProvider>
                              <AppWithVowel />
                            </DialogProvider>
                          </PluginLauncherProvider>
                        </PanelProvider>
                      </SidebarProvider>
                    </BreadcrumbProvider>
                  </TooltipProvider>
                </LiveUpdatesProvider>
              </ToastProvider>
            </EditorAutocompleteProvider>
          </CompanyProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
