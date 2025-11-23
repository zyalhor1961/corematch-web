'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface Shortcut {
  keys: string[]; // e.g., ['g', 'd'] for g then d
  description: string;
  category: 'navigation' | 'action' | 'global';
  action: () => void;
}

interface UseKeyboardShortcutsOptions {
  orgId: string;
  enabled?: boolean;
}

export function useKeyboardShortcuts({ orgId, enabled = true }: UseKeyboardShortcutsOptions) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Define all shortcuts
  const shortcuts: Shortcut[] = [
    // Navigation shortcuts (g + key)
    {
      keys: ['g', 'd'],
      description: 'Aller à Vue d\'ensemble',
      category: 'navigation',
      action: () => router.push(`/org/${orgId}`),
    },
    {
      keys: ['g', 'e'],
      description: 'Aller au dashboard ERP',
      category: 'navigation',
      action: () => router.push(`/org/${orgId}/erp`),
    },
    {
      keys: ['g', 'c'],
      description: 'Aller aux Clients',
      category: 'navigation',
      action: () => router.push(`/org/${orgId}/erp/clients`),
    },
    {
      keys: ['g', 'f'],
      description: 'Aller aux Factures',
      category: 'navigation',
      action: () => router.push(`/org/${orgId}/erp/invoices`),
    },
    {
      keys: ['g', 's'],
      description: 'Aller aux Fournisseurs',
      category: 'navigation',
      action: () => router.push(`/org/${orgId}/erp/suppliers`),
    },
    {
      keys: ['g', 'a'],
      description: 'Aller aux Achats',
      category: 'navigation',
      action: () => router.push(`/org/${orgId}/erp/purchases`),
    },
    {
      keys: ['g', 'b'],
      description: 'Aller à la Banque',
      category: 'navigation',
      action: () => router.push(`/org/${orgId}/erp/bank`),
    },
    {
      keys: ['g', 'l'],
      description: 'Aller au Lettrage',
      category: 'navigation',
      action: () => router.push(`/org/${orgId}/erp/lettrage`),
    },
    {
      keys: ['g', 'j'],
      description: 'Aller aux Journaux comptables',
      category: 'navigation',
      action: () => router.push(`/org/${orgId}/erp/accounting`),
    },
    // Global shortcuts
    {
      keys: ['?'],
      description: 'Afficher l\'aide clavier',
      category: 'global',
      action: () => setShowHelp(true),
    },
  ];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ignore if modifier keys are pressed (except for ?)
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const key = e.key.toLowerCase();

      // Handle ? for help (with or without shift)
      if (e.key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // Handle / for search focus
      if (key === '/' && !e.shiftKey) {
        const searchInput = document.querySelector<HTMLInputElement>(
          '[data-search-input]'
        );
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          return;
        }
      }

      // Handle pending key sequences (g + something)
      if (pendingKey === 'g') {
        const shortcut = shortcuts.find(
          (s) => s.keys.length === 2 && s.keys[0] === 'g' && s.keys[1] === key
        );
        if (shortcut) {
          e.preventDefault();
          shortcut.action();
        }
        setPendingKey(null);
        return;
      }

      // Start new sequence
      if (key === 'g') {
        e.preventDefault();
        setPendingKey('g');
        // Clear pending key after timeout
        setTimeout(() => setPendingKey(null), 1500);
        return;
      }
    },
    [enabled, pendingKey, shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    shortcuts,
    pendingKey,
    showHelp,
    setShowHelp,
  };
}

// Group shortcuts by category for display
export function groupShortcutsByCategory(shortcuts: Shortcut[]) {
  const groups: Record<string, Shortcut[]> = {
    navigation: [],
    action: [],
    global: [],
  };

  shortcuts.forEach((shortcut) => {
    groups[shortcut.category].push(shortcut);
  });

  return groups;
}
