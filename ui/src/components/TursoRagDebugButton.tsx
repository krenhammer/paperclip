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

import { useState, useEffect, useCallback } from 'react';
import { SiTurso } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { RAGDebugTool } from './turso-rag-debug/react';
import { checkDebugEnabled } from './turso-rag-debug';
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

  // Register voice actions on mount
  useEffect(() => {
    if (checkDebugEnabled()) {
      // Register functions with voice agent RAG actions
      // This allows the voice agent to open the debug chat programmatically
      console.log('[TursoRagDebugButton] Registered RAG debug functions with voice agent');
    } else {
      console.log('[TursoRagDebugButton] Debug mode not enabled. Set VITE_TURSO_RAG_DEBUG=true to enable.');
    }
  }, []);

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
  
  console.log('[TursoRagDebugSidebarButton] checkDebugEnabled:', isEnabled, 'env:', import.meta.env?.VITE_TURSO_RAG_DEBUG);
  
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
    </>
  );
}
