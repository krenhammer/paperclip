/**
 * TursoRagDebugButton Component
 *
 * A button component that initializes and controls the Turso Browser RAG debug tool.
 * Shows a database/Turso icon and can be positioned in various locations.
 *
 * @module components/TursoRagDebugButton
 */

import { useEffect, useCallback } from 'react';
import { SiTurso } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  initializeTursoRagDebug,
  toggleDialog,
  checkDebugEnabled,
  openChatWithQuery,
} from './turso-rag-debug';
import { registerRagDebugFunctions } from '@/vowel.rag-actions';

/**
 * Props for the TursoRagDebugButton component
 */
interface TursoRagDebugButtonProps {
  /** Optional additional CSS classes */
  className?: string;
  /** Size variant for the button */
  size?: 'sm' | 'md' | 'lg';
  /** Color variant */
  variant?: 'purple' | 'default' | 'secondary' | 'ghost';
  /** Whether to show as a full-width button with text (for sidebars) */
  fullWidth?: boolean;
}

/**
 * Size class mappings
 */
const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

/**
 * Icon size mappings
 */
const iconSizes = {
  sm: 14,
  md: 18,
  lg: 22,
};

/**
 * Variant style mappings
 */
const variantStyles = {
  purple: 'bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0 shadow-lg hover:shadow-xl',
  default: 'bg-background border border-border hover:bg-accent text-foreground',
  secondary: 'bg-secondary hover:bg-secondary/80 text-secondary-foreground border-0',
  ghost: 'hover:bg-accent text-foreground border-0',
};

/**
 * Button to toggle the Turso Browser RAG debug dialog.
 *
 * The debug tool is only initialized if VITE_TURSO_RAG_DEBUG=true is set
 * in the environment, or if the user has force-enabled it via localStorage.
 *
 * @example
 * ```tsx
 * <TursoRagDebugButton size="md" variant="default" />
 * ```
 */
export function TursoRagDebugButton({
  className,
  size = 'md',
  variant = 'purple',
  fullWidth = false,
}: TursoRagDebugButtonProps) {
  // Initialize the Turso RAG debug tool on mount and register with voice actions
  useEffect(() => {
    // Only initialize if debug mode is enabled
    if (checkDebugEnabled()) {
      console.log('[TursoRagDebugButton] Debug mode enabled, initializing...');
      initializeTursoRagDebug();

      // Register functions with voice agent RAG actions
      // This allows the voice agent to open the debug chat programmatically
      registerRagDebugFunctions({
        openChat: openChatWithQuery,
      });
      console.log('[TursoRagDebugButton] Registered RAG debug functions with voice agent');
    } else {
      console.log('[TursoRagDebugButton] Debug mode not enabled. Set VITE_TURSO_RAG_DEBUG=true to enable.');
    }
  }, []);

  // Handle button click - toggle the debug dialog
  const handleClick = useCallback(() => {
    toggleDialog();
  }, []);

  // If debug mode is not enabled, don't render the button
  if (!checkDebugEnabled()) {
    return null;
  }

  // Full width version for sidebar placement
  if (fullWidth) {
    return (
      <button
        onClick={handleClick}
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors w-full text-left',
          'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
          className
        )}
      >
        <SiTurso className="h-4 w-4 shrink-0" />
        <span className="truncate">RAG Debug</span>
      </button>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleClick}
            className={cn(
              'relative transition-all duration-200',
              variantStyles[variant],
              'hover:scale-105 active:scale-95',
              sizeClasses[size],
              className
            )}
            aria-label="Open Turso Browser RAG Debug Tool"
          >
            <SiTurso size={iconSizes[size]} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center">
          <p className="text-xs">Turso Browser RAG Debug</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Sidebar version of the button with text.
 * Useful for placement in left sidebars alongside nav items.
 */
export function TursoRagDebugSidebarButton({
  className,
}: {
  className?: string;
}) {
  // Initialize the Turso RAG debug tool on mount
  useEffect(() => {
    if (checkDebugEnabled()) {
      initializeTursoRagDebug();
    }
  }, []);

  const handleClick = useCallback(() => {
    toggleDialog();
  }, []);

  const isEnabled = checkDebugEnabled();
  console.log('[TursoRagDebugSidebarButton] checkDebugEnabled:', isEnabled, 'env:', import.meta.env?.VITE_TURSO_RAG_DEBUG);
  if (!isEnabled) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors w-full text-left rounded-md',
        'text-foreground hover:bg-accent hover:text-foreground',
        className
      )}
    >
      <SiTurso className="h-4 w-4 shrink-0 text-primary" />
      <span className="truncate">RAG Debug</span>
    </button>
  );
}
