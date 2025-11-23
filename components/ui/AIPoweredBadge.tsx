'use client';

import { Sparkles } from 'lucide-react';

interface AIPoweredBadgeProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function AIPoweredBadge({ size = 'sm', className = '' }: AIPoweredBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-sm gap-1.5',
  };

  const iconSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
  };

  return (
    <span
      className={`inline-flex items-center ${sizeClasses[size]} rounded-full bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 text-purple-700 dark:text-purple-300 font-medium ${className}`}
    >
      <Sparkles className={iconSize[size]} />
      <span>IA</span>
    </span>
  );
}
