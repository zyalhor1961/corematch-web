'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarTooltipProps {
  content: string;
  children: React.ReactNode;
  enabled?: boolean;
  side?: 'right' | 'top';
}

export function SidebarTooltip({
  content,
  children,
  enabled = true,
  side = 'right'
}: SidebarTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      if (side === 'right') {
        setPosition({
          top: rect.top + rect.height / 2,
          left: rect.right + 8,
        });
      } else {
        setPosition({
          top: rect.top - 8,
          left: rect.left + rect.width / 2,
        });
      }
    }
  };

  const handleMouseEnter = () => {
    if (!enabled) return;
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
    }, 100);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="w-full"
      >
        {children}
      </div>
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {isVisible && enabled && (
            <motion.div
              initial={{ opacity: 0, x: side === 'right' ? -4 : 0, y: side === 'top' ? 4 : 0 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: side === 'right' ? -4 : 0, y: side === 'top' ? 4 : 0 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[100] pointer-events-none"
              style={{
                top: side === 'right' ? position.top : position.top,
                left: side === 'right' ? position.left : position.left,
                transform: side === 'right'
                  ? 'translateY(-50%)'
                  : 'translate(-50%, -100%)',
              }}
            >
              {/* Tooltip Container */}
              <div className="relative">
                {/* Arrow */}
                {side === 'right' && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-slate-900 rotate-45 border-l border-b border-white/10"
                  />
                )}
                {side === 'top' && (
                  <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-white/10"
                  />
                )}
                {/* Content */}
                <div className="relative bg-slate-900 text-white text-sm font-medium px-3 py-1.5 rounded-md border border-white/10 shadow-xl whitespace-nowrap">
                  {content}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

export default SidebarTooltip;
