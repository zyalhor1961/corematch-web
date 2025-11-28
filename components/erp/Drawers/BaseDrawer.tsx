'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BaseDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  showOverlay?: boolean;
  footer?: React.ReactNode;
}

const widthClasses = {
  sm: 'w-[400px]',
  md: 'w-[500px]',
  lg: 'w-[600px]',
  xl: 'w-[800px]',
};

export function BaseDrawer({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  width = 'md',
  showOverlay = true,
  footer,
}: BaseDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (open) {
      // Small delay for animation
      requestAnimationFrame(() => setIsVisible(true));
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      {showOverlay && (
        <div
          className={cn(
            'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
            isVisible ? 'opacity-100' : 'opacity-0'
          )}
          onClick={onClose}
        />
      )}

      {/* Drawer Panel */}
      <div
        className={cn(
          'absolute right-0 top-0 h-full flex flex-col',
          'bg-[#0B1121]/95 backdrop-blur-xl border-l border-white/10',
          'shadow-2xl shadow-black/50',
          'transition-transform duration-300 ease-out',
          widthClasses[width],
          isVisible ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Neural Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

        {/* Header */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                {icon}
              </div>
            )}
            <div>
              <h2 className="font-semibold text-lg text-white">{title}</h2>
              {subtitle && (
                <p className="text-xs text-slate-400">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-white/10 p-4 bg-slate-900/50 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default BaseDrawer;
