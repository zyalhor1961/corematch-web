'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Search,
  Users,
  FileText,
  Building2,
  Receipt,
  Plus,
  Settings,
  CreditCard,
  BookOpen,
  ClipboardList,
  ShoppingCart,
  Landmark,
  Link2,
  BarChart3,
  Sparkles,
  Command,
  ArrowRight,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'navigation' | 'action' | 'erp';
  keywords?: string[];
}

interface CommandBarProps {
  orgId: string;
}

export function CommandBar({ orgId }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  // Define all commands
  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-dashboard',
      label: 'Vue d\'ensemble',
      description: 'Tableau de bord principal',
      icon: <BarChart3 className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}`),
      category: 'navigation',
      keywords: ['dashboard', 'accueil', 'home'],
    },
    {
      id: 'nav-cv',
      label: 'CV Screening',
      description: 'Analyser des CVs',
      icon: <Users className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/cv`),
      category: 'navigation',
      keywords: ['candidat', 'recrutement', 'talent'],
    },
    {
      id: 'nav-daf',
      label: 'Documents DAF',
      description: 'Gestion documentaire intelligente',
      icon: <FileText className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/daf`),
      category: 'navigation',
      keywords: ['facture', 'document', 'comptabilite'],
    },
    {
      id: 'nav-ask-daf',
      label: 'Ask DAF',
      description: 'Assistant IA financier',
      icon: <Sparkles className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/daf?tab=ask`),
      category: 'navigation',
      keywords: ['ia', 'question', 'assistant', 'chat'],
    },
    {
      id: 'nav-erp',
      label: 'Core ERP',
      description: 'Dashboard ERP',
      icon: <Receipt className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp`),
      category: 'navigation',
      keywords: ['erp', 'comptabilite', 'gestion'],
    },
    {
      id: 'nav-settings',
      label: 'Paramètres',
      description: 'Configurer l\'organisation',
      icon: <Settings className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/settings`),
      category: 'navigation',
      keywords: ['config', 'reglages'],
    },
    {
      id: 'nav-billing',
      label: 'Facturation',
      description: 'Gérer l\'abonnement',
      icon: <CreditCard className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/billing`),
      category: 'navigation',
      keywords: ['paiement', 'abonnement', 'plan'],
    },

    // ERP Navigation
    {
      id: 'erp-clients',
      label: 'Clients',
      description: 'Gérer les clients',
      icon: <Users className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/clients`),
      category: 'erp',
      keywords: ['client', 'contact', 'carnet'],
    },
    {
      id: 'erp-suppliers',
      label: 'Fournisseurs',
      description: 'Gérer les fournisseurs',
      icon: <Building2 className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/suppliers`),
      category: 'erp',
      keywords: ['fournisseur', 'achat', 'vendor'],
    },
    {
      id: 'erp-invoices',
      label: 'Factures clients',
      description: 'Voir les factures',
      icon: <FileText className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/invoices`),
      category: 'erp',
      keywords: ['facture', 'vente'],
    },
    {
      id: 'erp-purchases',
      label: 'Factures fournisseurs',
      description: 'Achats et dépenses',
      icon: <ShoppingCart className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/purchases`),
      category: 'erp',
      keywords: ['achat', 'depense', 'fournisseur'],
    },
    {
      id: 'erp-quotes',
      label: 'Devis',
      description: 'Gérer les devis',
      icon: <ClipboardList className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/quotes`),
      category: 'erp',
      keywords: ['devis', 'proposition', 'offre'],
    },
    {
      id: 'erp-expenses',
      label: 'Dépenses',
      description: 'Notes de frais',
      icon: <Receipt className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/expenses`),
      category: 'erp',
      keywords: ['depense', 'frais', 'note'],
    },
    {
      id: 'erp-accounting',
      label: 'Journaux comptables',
      description: 'Écritures comptables',
      icon: <BookOpen className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/accounting`),
      category: 'erp',
      keywords: ['journal', 'ecriture', 'comptabilite'],
    },
    {
      id: 'erp-bank',
      label: 'Rapprochement bancaire',
      description: 'Réconciliation bancaire',
      icon: <Landmark className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/bank`),
      category: 'erp',
      keywords: ['banque', 'rapprochement', 'reconciliation'],
    },
    {
      id: 'erp-lettrage',
      label: 'Lettrage',
      description: 'Lettrage comptable',
      icon: <Link2 className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/lettrage`),
      category: 'erp',
      keywords: ['lettrage', 'pointage'],
    },

    // Actions
    {
      id: 'action-new-client',
      label: 'Nouveau client',
      description: 'Créer un client',
      icon: <Plus className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/clients?action=new`),
      category: 'action',
      keywords: ['creer', 'ajouter', 'client'],
    },
    {
      id: 'action-new-supplier',
      label: 'Nouveau fournisseur',
      description: 'Créer un fournisseur',
      icon: <Plus className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/suppliers?action=new`),
      category: 'action',
      keywords: ['creer', 'ajouter', 'fournisseur'],
    },
    {
      id: 'action-new-invoice',
      label: 'Nouvelle facture client',
      description: 'Créer une facture',
      icon: <Plus className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/invoices/new`),
      category: 'action',
      keywords: ['creer', 'ajouter', 'facture'],
    },
    {
      id: 'action-new-purchase',
      label: 'Nouvelle facture fournisseur',
      description: 'Saisir une facture d\'achat',
      icon: <Plus className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/purchases/new`),
      category: 'action',
      keywords: ['creer', 'ajouter', 'achat', 'fournisseur'],
    },
    {
      id: 'action-new-quote',
      label: 'Nouveau devis',
      description: 'Créer un devis',
      icon: <Plus className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/quotes/new`),
      category: 'action',
      keywords: ['creer', 'ajouter', 'devis'],
    },
  ], [orgId, router]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;

    const searchLower = search.toLowerCase();
    return commands.filter(cmd => {
      const labelMatch = cmd.label.toLowerCase().includes(searchLower);
      const descMatch = cmd.description?.toLowerCase().includes(searchLower);
      const keywordMatch = cmd.keywords?.some(k => k.includes(searchLower));
      return labelMatch || descMatch || keywordMatch;
    });
  }, [commands, search]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      action: [],
      navigation: [],
      erp: [],
    };

    filteredCommands.forEach(cmd => {
      groups[cmd.category].push(cmd);
    });

    return groups;
  }, [filteredCommands]);

  // Keyboard shortcut to open and navigation when open
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Open/close with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
        return;
      }

      // Only handle navigation keys when dialog is open
      if (!open) return;

      const totalItems = filteredCommands.length;
      if (totalItems === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % totalItems);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            setOpen(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [open, filteredCommands, selectedIndex]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Execute command
  const executeCommand = (cmd: CommandItem) => {
    cmd.action();
    setOpen(false);
  };

  // Calculate flat index for selection
  const getFlatIndex = (category: string, index: number): number => {
    let offset = 0;
    const categories = ['action', 'navigation', 'erp'];
    for (const cat of categories) {
      if (cat === category) break;
      offset += groupedCommands[cat].length;
    }
    return offset + index;
  };

  const categoryLabels: Record<string, string> = {
    action: 'Actions rapides',
    navigation: 'Navigation',
    erp: 'Core ERP',
  };

  return (
    <>
      {/* Trigger button (optional - can be used in header) */}
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span>Rechercher...</span>
        <kbd className="ml-2 flex items-center gap-0.5 text-xs bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
          <Command className="h-3 w-3" />
          <span>K</span>
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl p-0 gap-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center border-b border-gray-200 dark:border-gray-700 px-4">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Rechercher une commande..."
              className="flex-1 px-3 py-4 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400"
              autoFocus
            />
            <kbd className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500">
              ESC
            </kbd>
          </div>

          {/* Commands list */}
          <div className="max-h-[400px] overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Aucun résultat pour "{search}"</p>
              </div>
            ) : (
              <>
                {(['action', 'navigation', 'erp'] as const).map(category => {
                  const items = groupedCommands[category];
                  if (items.length === 0) return null;

                  return (
                    <div key={category} className="mb-2">
                      <div className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {categoryLabels[category]}
                      </div>
                      {items.map((cmd, idx) => {
                        const flatIdx = getFlatIndex(category, idx);
                        const isSelected = flatIdx === selectedIndex;

                        return (
                          <button
                            key={cmd.id}
                            onClick={() => executeCommand(cmd)}
                            onMouseEnter={() => setSelectedIndex(flatIdx)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            <span className={`flex-shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                              {cmd.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{cmd.label}</div>
                              {cmd.description && (
                                <div className={`text-xs ${isSelected ? 'text-blue-500 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                  {cmd.description}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <ArrowRight className="h-4 w-4 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer hints */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">↑↓</kbd>
              naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">↵</kbd>
              sélectionner
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">ESC</kbd>
              fermer
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
