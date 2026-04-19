/**
 * @module turso-rag-debug/react/StatusBar
 *
 * Status bar component for the RAG debug tool.
 *
 * Displays status indicator, message, progress bar, and chunk count.
 *
 * @packageDocumentation
 */

import React from 'react';
import * as Progress from '@radix-ui/react-progress';

/**
 * Props for the StatusBar component
 *
 * @public
 */
export interface StatusBarProps {
  /** Status message to display */
  message: string;
  /** Status type for color */
  type: 'loading' | 'error' | 'ready';
  /** Progress percentage (0-100) */
  progress?: number;
  /** Number of indexed chunks */
  chunkCount?: number;
}

/**
 * Maps status type to dot color
 */
const STATUS_COLORS = {
  loading: '#f59e0b',
  error: '#ef4444',
  ready: '#22c55e',
} as const;

/**
 * Status bar component for the RAG debug tool.
 *
 * Features:
 * - Status dot with color based on type (blue=loading, red=error, green=ready)
 * - Message text
 * - Progress bar using @radix-ui/react-progress
 * - Chunk count display
 *
 * @example
 * ```tsx
 * <StatusBar
 *   message="Loading documents..."
 *   type="loading"
 *   progress={45}
 *   chunkCount={128}
 * />
 * ```
 *
 * @public
 */
export function StatusBar({
  message,
  type,
  progress,
  chunkCount,
}: StatusBarProps): React.ReactElement {
  const showProgressBar = progress !== undefined && progress > 0 && progress < 100;
  const dotColor = STATUS_COLORS[type];

  return (
    <div className="rag-debug-status">
      {/* Status Dot */}
      <span
        id="rag-debug-status-dot"
        className={`rag-debug-status-dot ${type === 'loading' ? 'loading' : ''} ${type === 'error' ? 'error' : ''}`}
        style={{
          backgroundColor: type === 'ready' ? undefined : dotColor,
        }}
        aria-label={`Status: ${type}`}
      />

      {/* Message */}
      <span id="rag-debug-status-text">{message}</span>

      {/* Progress Bar using @radix-ui/react-progress */}
      {showProgressBar && (
        <>
          <div id="rag-debug-progress-container" className="rag-debug-progress-container">
            <Progress.Root
              className="rag-debug-progress-root"
              value={progress}
              max={100}
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '99999px',
                width: '100%',
                height: '6px',
              }}
            >
              <Progress.Indicator
                style={{
                  background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                  borderRadius: '99999px',
                  height: '100%',
                  transition: 'width 0.3s ease',
                  width: `${progress}%`,
                }}
              />
            </Progress.Root>
          </div>
          <span id="rag-debug-progress-text" className="rag-debug-progress-text">
            {Math.round(progress)}%
          </span>
        </>
      )}

      {/* Chunk Count */}
      {chunkCount !== undefined && (
        <span id="rag-debug-index-size" className="rag-debug-index-size">
          | {chunkCount} chunks indexed
        </span>
      )}
    </div>
  );
}

export default StatusBar;
