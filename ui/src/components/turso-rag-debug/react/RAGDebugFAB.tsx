/**
 * @module turso-rag-debug/react/RAGDebugFAB
 *
 * Floating Action Button component for the RAG debug tool.
 *
 * Provides a visually prominent FAB with loading state support,
 * progress indication, and smooth animations.
 *
 * @packageDocumentation
 */

import React from 'react';
import { SiTurso } from 'react-icons/si';
import { ReusableSpinner } from './ReusableSpinner';

/**
 * Props for the RAGDebugFAB component
 *
 * @public
 */
export interface RAGDebugFABProps {
  /** Whether the button is in a loading state */
  isLoading: boolean;
  /** Amber “still initializing” styling; FAB stays clickable */
  isWarming?: boolean;
  /** Loading progress percentage (0-100) */
  progress: number;
  /** Whether the button is disabled */
  disabled: boolean;
  /** Click handler for the button */
  onClick: () => void;
}

/**
 * Floating Action Button for the RAG debug tool.
 *
 * Features:
 * - Fixed position in bottom-left corner
 * - Blue gradient background matching the debug tool theme
 * - Smooth hover and active animations
 * - Loading state with spinner and progress bar
 * - Turso icon when not loading
 * - Accessible with proper ARIA attributes
 *
 * @example
 * ```tsx
 * <RAGDebugFAB
 *   isLoading={false}
 *   progress={0}
 *   disabled={false}
 *   onClick={() => console.log('FAB clicked')}
 * />
 * ```
 *
 * @public
 */
export function RAGDebugFAB({
  isLoading,
  isWarming = false,
  progress,
  disabled,
  onClick,
}: RAGDebugFABProps): React.ReactElement {
  const handleClick = (): void => {
    if (!disabled) {
      onClick();
    }
  };

  const buttonTitle = isLoading
    ? `Loading Turso Browser RAG... ${Math.round(progress)}% (click to open)`
    : 'Open Turso Browser RAG Debug Tool';

  const fabClass =
    `rag-debug-fab${isLoading ? ' loading' : ''}` +
    `${isWarming ? ' warming' : ''}` +
    `${disabled ? ' disabled' : ''}`;

  return (
    <button
      className={fabClass}
      onClick={handleClick}
      disabled={disabled}
      title={buttonTitle}
      aria-label={buttonTitle}
      aria-disabled={disabled}
      type="button"
    >
      {isLoading ? (
        <>
          <ReusableSpinner size={24} color="white" />
          <div className="rag-debug-fab-progress">
            <div
              className="rag-debug-fab-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      ) : (
        <SiTurso size={24} color="white" />
      )}
    </button>
  );
}

export default RAGDebugFAB;
