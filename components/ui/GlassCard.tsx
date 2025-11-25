"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  /** Optional padding override - defaults to p-6 */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Add a subtle glow effect */
  glow?: 'none' | 'teal' | 'purple';
}

/**
 * GlassCard - Nebula Design System Foundation Component
 *
 * A glassmorphism card with:
 * - bg-[#0F172A]/60 (Navy Glass with 60% opacity)
 * - backdrop-blur-xl (24px blur)
 * - border-white/5 (Ultra-fine border)
 * - shadow-2xl (Deep shadow)
 * - rounded-2xl (16px border radius)
 */
const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  hoverEffect = false,
  padding = 'md',
  glow = 'none',
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const glowClasses = {
    none: '',
    teal: 'shadow-[0_0_20px_rgba(0,180,216,0.15)]',
    purple: 'shadow-[0_0_20px_rgba(167,139,250,0.15)]',
  };

  return (
    <div
      className={cn(
        // Base Glassmorphism
        'bg-[#0F172A]/60',
        'backdrop-blur-xl',
        'border border-white/5',
        'shadow-2xl',
        'rounded-2xl',
        // Padding
        paddingClasses[padding],
        // Glow effect
        glowClasses[glow],
        // Hover effect - subtle lift
        hoverEffect && [
          'transition-all duration-300 ease-out',
          'hover:-translate-y-1',
          'hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)]',
          'hover:border-white/10',
        ],
        // Custom classes
        className
      )}
    >
      {children}
    </div>
  );
};

export default GlassCard;

// Named export for flexibility
export { GlassCard };
