'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  History,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'navigation' | 'action' | 'sales' | 'purchase' | 'finance' | 'data';
  keywords?: string[];
}

interface CommandBarProps {
  orgId: string;
}

export function CommandBar({ orgId }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dataResults, setDataResults] = useState<CommandItem[]>([]);
  const router = useRouter();

  // Define static commands
  const staticCommands: CommandItem[] = useMemo(() => [
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
      label: 'CV Studio',
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

    // Sales Hub
    {
      id: 'erp-clients',
      label: 'Clients',
      description: 'Gérer les clients',
      icon: <Users className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/clients`),
      category: 'sales',
      keywords: ['client', 'contact', 'carnet'],
    },
    {
      id: 'erp-quotes',
      label: 'Devis',
      description: 'Gérer les devis',
      icon: <FileText className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/quotes`),
      category: 'sales',
      keywords: ['devis', 'proposition', 'commercial'],
    },
    {
      id: 'erp-invoices',
      label: 'Factures clients',
      description: 'Voir les factures',
      icon: <FileText className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/invoices`),
      category: 'sales',
      keywords: ['facture', 'vente'],
    },

    // Purchase Hub
    {
      id: 'erp-suppliers',
      label: 'Fournisseurs',
      description: 'Gérer les fournisseurs',
      icon: <Building2 className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/suppliers`),
      category: 'purchase',
      keywords: ['fournisseur', 'achat', 'vendor'],
    },
    {
      id: 'erp-purchases',
      label: 'Achats',
      description: 'Factures fournisseurs',
      icon: <ShoppingCart className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/purchases`),
      category: 'purchase',
      keywords: ['achat', 'depense', 'fournisseur'],
    },
    {
      id: 'erp-expenses',
      label: 'Dépenses',
      description: 'Notes de frais & divers',
      icon: <Receipt className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/expenses`),
      category: 'purchase',
      keywords: ['frais', 'note', 'ticket'],
    },

    // Finance Hub
    {
      id: 'erp-bank',
      label: 'Rapprochement bancaire',
      description: 'Réconciliation bancaire',
      icon: <Landmark className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/bank`),
      category: 'finance',
      keywords: ['banque', 'rapprochement', 'reconciliation'],
    },
    {
      id: 'erp-accounting',
      label: 'Comptabilité',
      description: 'Journaux & Grand Livre',
      icon: <BookOpen className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/accounting`),
      category: 'finance',
      keywords: ['compta', 'journal', 'ecriture'],
    },
    {
      id: 'erp-matching',
      label: 'Lettrage',
      description: 'Lettrage des comptes',
      icon: <Link2 className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/lettrage`),
      category: 'finance',
      keywords: ['lettrage', 'rapprochement', 'lien'],
    },
    {
      id: 'erp-coa',
      label: 'Plan Comptable',
      description: 'Comptes généraux',
      icon: <ClipboardList className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/chart-of-accounts`),
      category: 'finance',
      keywords: ['plan', 'compte', 'pcg'],
    },

    // Actions
    {
      id: 'action-new-invoice',
      label: 'Nouvelle facture',
      description: 'Créer une facture client',
      icon: <Plus className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/invoices/new`),
      category: 'action',
      keywords: ['creer', 'ajouter', 'facture'],
    },
    {
      id: 'action-new-quote',
      label: 'Nouveau devis',
      description: 'Créer un devis client',
      icon: <Plus className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/quotes/new`),
      category: 'action',
      keywords: ['creer', 'ajouter', 'devis'],
    },
    {
      id: 'action-new-client',
      label: 'Nouveau client',
      description: 'Ajouter un client',
      icon: <Plus className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/erp/clients?action=new`),
      category: 'action',
      keywords: ['creer', 'ajouter', 'client'],
    },
    {
      id: 'action-upload',
      label: 'Uploader un document',
      description: 'Scanner une facture/document',
      icon: <Plus className="h-4 w-4" />,
      action: () => router.push(`/org/${orgId}/daf`),
      category: 'action',
      keywords: ['upload', 'scanner', 'importer'],
    },
  ], [orgId, router]);

  // Simulate Data Search
  useEffect(() => {
    if (!search.trim()) {
      setDataResults([]);
      return;
    }

    const timer = setTimeout(() => {
      const query = search.toLowerCase();
      const results: CommandItem[] = [];

      // Mock Data - In production this would call an API
      if (query.includes('facture') || query.includes('inv') || query.match(/\d+/)) {
        results.push({
          id: 'inv-123',
          label: 'Facture #INV-2024-001',
          description: 'Client: Acme Corp - 1,200.00 €',
          icon: <FileText className="h-4 w-4 text-blue-500" />,
          action: () => router.push(`/org/${orgId}/erp/invoices`), // In real app: /invoices/id
          category: 'data',
        });
        results.push({
          id: 'inv-124',
          label: 'Facture #INV-2024-002',
          description: 'Client: Globex Inc - 4,500.00 €',
          icon: <FileText className="h-4 w-4 text-blue-500" />,
          action: () => router.push(`/org/${orgId}/erp/invoices`),
          category: 'data',
        });
      }

      if (query.includes('client') || query.includes('acme') || query.includes('globex')) {
        results.push({
          id: 'client-1',
          label: 'Acme Corp',
          description: 'Client - Paris',
          icon: <Users className="h-4 w-4 text-green-500" />,
          action: () => router.push(`/org/${orgId}/erp/clients`),
          category: 'data',
        });
      }

      if (query.includes('anthropic') || query.includes('fourn')) {
        results.push({
          id: 'supp-1',
          label: 'Anthropic',
          description: 'Fournisseur - AI Services',
          icon: <Building2 className="h-4 w-4 text-orange-500" />,
          action: () => router.push(`/org/${orgId}/erp/suppliers`),
          category: 'data',
        });
      }

      setDataResults(results);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, orgId, router]);

  // Combine and filter commands
  const filteredCommands = useMemo(() => {
    let commands = [...staticCommands];

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      commands = commands.filter(cmd => {
        const labelMatch = cmd.label.toLowerCase().includes(searchLower);
        const descMatch = cmd.description?.toLowerCase().includes(searchLower);
        const keywordMatch = cmd.keywords?.some(k => k.includes(searchLower));
        return labelMatch || descMatch || keywordMatch;
      });

      // Add data results at the top if searching
      return [...dataResults, ...commands];
    }

    return commands;
  }, [staticCommands, search, dataResults]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      data: [],
      action: [],
      navigation: [],
      erp: [],
    };

    filteredCommands.forEach(cmd => {
      if (groups[cmd.category]) {
        groups[cmd.category].push(cmd);
      }
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
      setDataResults([]);
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
    const categories = ['data', 'action', 'navigation', 'erp'];
    for (const cat of categories) {
      if (cat === category) break;
      offset += groupedCommands[cat].length;
    }
    return offset + index;
  };

  const categoryLabels: Record<string, string> = {
    data: 'Résultats de recherche',
    action: 'Actions rapides',
    navigation: 'Navigation',
    erp: 'Core ERP',
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl p-0 gap-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 overflow-hidden shadow-2xl">
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
              placeholder="Que souhaitez-vous faire ? (ex: Nouvelle facture, Analyse CV...)"
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
                <p>Je ne trouve rien pour "{search}"</p>
                <p className="text-xs mt-1">Essayez de chercher "Client", "Facture" ou "Analyse"</p>
              </div>
            ) : (
              <>
                {(['data', 'action', 'navigation', 'erp'] as const).map(category => {
                  const items = groupedCommands[category];
                  if (items.length === 0) return null;

                  return (
                    <div key={category} className="mb-2">
                      <div className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        {category === 'data' && <History className="w-3 h-3" />}
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
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isSelected
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
          <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">↑↓</kbd>
              naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">↵</kbd>
              sélectionner
            </span>
            <span className="flex items-center gap-1">
              <span className="text-blue-500">Astuce:</span>
              Tapez "facture" ou "client" pour chercher
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
