'use client';

import React, { useEffect } from 'react';
import { X, Keyboard, Command } from 'lucide-react';
import { Shortcut, groupShortcutsByCategory } from '@/hooks/useKeyboardShortcuts';

interface HelpShortcutsOverlayProps {
  shortcuts: Shortcut[];
  open: boolean;
  onClose: () => void;
}

const categoryLabels: Record<string, string> = {
  navigation: 'Navigation',
  action: 'Actions',
  global: 'Global',
};

function ShortcutKey({ keys }: { keys: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {keys.map((key, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="text-gray-400 text-xs">puis</span>}
          <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
            {key === '?' ? '?' : key.toUpperCase()}
          </kbd>
        </React.Fragment>
      ))}
    </div>
  );
}

export function HelpShortcutsOverlay({
  shortcuts,
  open,
  onClose,
}: HelpShortcutsOverlayProps) {
  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onClose]);

  if (!open) return null;

  const grouped = groupShortcutsByCategory(shortcuts);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Keyboard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2
                  id="shortcuts-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  Raccourcis clavier
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Naviguez plus rapidement avec le clavier
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
            {/* Command Bar hint */}
            <div className="mb-6 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800/30">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs font-mono font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 flex items-center gap-1">
                    <Command className="h-3 w-3" />
                    <span>K</span>
                  </kbd>
                </div>
                <span className="text-sm text-purple-700 dark:text-purple-300">
                  Ouvrir la barre de commandes (recherche rapide)
                </span>
              </div>
            </div>

            {/* Shortcuts by category */}
            {Object.entries(grouped).map(([category, categoryShortcuts]) => {
              if (categoryShortcuts.length === 0) return null;

              return (
                <div key={category} className="mb-6 last:mb-0">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    {categoryLabels[category]}
                  </h3>
                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {shortcut.description}
                        </span>
                        <ShortcutKey keys={shortcut.keys} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Additional info */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <strong>Astuce :</strong> Appuyez sur <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">G</kbd> puis une lettre pour naviguer rapidement. Par exemple, <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">G</kbd> puis <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">C</kbd> pour aller aux Clients.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Appuyez sur <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded text-xs font-mono border">ESC</kbd> pour fermer
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
