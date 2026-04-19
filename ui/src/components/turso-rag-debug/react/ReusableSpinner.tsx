/**
 * @module turso-rag-debug/react/ReusableSpinner
 *
 * Reusable spinner component for loading states.
 *
 * Provides a clean, professional spinner with CSS animation
 * using Radix-style aesthetics.
 *
 * @packageDocumentation
 */

import React from 'react';

/**
 * Props for the ReusableSpinner component
 *
 * @public
 */
export interface SpinnerProps {
  /** Size of the spinner in pixels (default: 24) */
  size?: number;
  /** Color of the spinner (default: 'white') */
  color?: string;
}

/**
 * Reusable spinner component with smooth CSS rotation animation.
 *
 * Features:
 * - Configurable size and color
 * - Radix-style aesthetics with stroke-dasharray animation
 * - CSS-only animation for performance
 *
 * @example
 * ```tsx
 * <ReusableSpinner size={32} color="#3b82f6" />
 * ```
 *
 * @public
 */
export function ReusableSpinner({ size = 24, color = 'white' }: SpinnerProps): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        animation: 'rag-debug-spin 1s linear infinite',
      }}
    >
      {/* Background track */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="60"
        strokeDashoffset="20"
        opacity="0.25"
      />
      {/* Animated spinner arc */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="30 60"
      />
    </svg>
  );
}

/**
 * CSS animation keyframes for the spinner.
 * Add this to your global styles or CSS-in-JS solution:
 *
 * ```css
 * @keyframes rag-debug-spin {
 *   from { transform: rotate(0deg); }
 *   to { transform: rotate(360deg); }
 * }
 * ```
 *
 * @public
 */
export const SPINNER_CSS = `
@keyframes rag-debug-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

export default ReusableSpinner;
