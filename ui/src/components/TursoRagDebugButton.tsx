/**
 * TursoRagDebugButton Component
 *
 * A button component that initializes and controls the Turso Browser RAG debug tool.
 * Shows a database/Turso icon and can be positioned in various locations.
 *
 * Uses the React-based RAGDebugTool component for the UI.
 *
 * @module components/TursoRagDebugButton
 */

import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { SiTurso } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTursoRagVoiceGate } from '@/lib/turso-rag-voice-gate';
import { RAGDebugTool } from './turso-rag-debug/react';
import { checkDebugEnabled } from './turso-rag-debug';

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
 * The RAGDebugTool React component handles the actual UI (FAB, dialog, etc.)
 * This button is kept for compatibility with existing layouts.
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
  // State for controlling the dialog
  const [isOpen, setIsOpen] = useState(false);
  const ragGate = useTursoRagVoiceGate();
  const ragWarming = (ragGate.loading || !ragGate.ready) && !ragGate.error;

  // Handle button click - toggle the dialog
  const handleClick = useCallback(() => {
    setIsOpen((prev) => !prev);
    console.log('[TursoRagDebugButton] Toggled dialog:', !isOpen);
  }, [isOpen]);

  // If debug mode is not enabled, don't render anything
  if (!checkDebugEnabled()) {
    return null;
  }

  // Full width version for sidebar placement
  if (fullWidth) {
    return (
      <>
        <RAGDebugTool isOpen={isOpen} onOpenChange={setIsOpen} showFAB={false} />
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors w-full text-left rounded-md',
            'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            ragWarming &&
              'ring-2 ring-amber-400/70 ring-offset-2 ring-offset-background bg-amber-500/10 text-amber-950 dark:text-amber-100',
            className
          )}
        >
          {ragWarming ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-600 dark:text-amber-400" aria-hidden />
          ) : (
            <SiTurso className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">RAG Debug</span>
        </button>
      </>
    );
  }

  return (
    <>
      <RAGDebugTool isOpen={isOpen} onOpenChange={setIsOpen} showFAB={false} />
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
                ragWarming &&
                  'ring-2 ring-amber-400/80 ring-offset-2 ring-offset-background border-amber-400/50',
                sizeClasses[size],
                className
              )}
              aria-label={
                ragWarming
                  ? 'Turso RAG loading — click to open debug panel'
                  : 'Open Turso Browser RAG Debug Tool'
              }
            >
              {ragWarming ? (
                <Loader2
                  size={iconSizes[size]}
                  className="animate-spin text-amber-600 dark:text-amber-400"
                  aria-hidden="true"
                />
              ) : (
                <SiTurso size={iconSizes[size]} aria-hidden="true" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="center">
            <p className="text-xs">
              {ragWarming
                ? `Loading RAG… ${Math.round(ragGate.progress)}% — click to open`
                : 'Turso Browser RAG Debug'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
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
  const [isOpen, setIsOpen] = useState(false);
  const isEnabled = checkDebugEnabled();
  const ragGate = useTursoRagVoiceGate();
  const ragWarming = (ragGate.loading || !ragGate.ready) && !ragGate.error;

  if (!isEnabled) {
    return null;
  }

  const handleClick = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <>
      <RAGDebugTool isOpen={isOpen} onOpenChange={setIsOpen} showFAB={false} />
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors w-full text-left rounded-md',
          'text-foreground hover:bg-accent hover:text-foreground',
          ragWarming &&
            'ring-2 ring-amber-400/70 ring-offset-2 ring-offset-background bg-amber-500/10',
          className
        )}
      >
        {ragWarming ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-600 dark:text-amber-400" aria-hidden />
        ) : (
          <SiTurso className="h-4 w-4 shrink-0 text-primary" />
        )}
        <span className="truncate">RAG Debug</span>
      </button>
    </>
  );
}
