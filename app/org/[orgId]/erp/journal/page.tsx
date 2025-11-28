'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { BookOpen, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  JournalListCard,
  JournalEntryModal,
  type JournalEntry,
} from '@/components/erp';

export default function JournalPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  useEffect(() => {
    loadEntries();
  }, [orgId]);

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      // In a real app, this would load from erp_journal_entries table
      // For now, using mock data to demonstrate the UI
      const mockEntries: JournalEntry[] = [
        {
          id: '1',
          entry_number: 'AC-2024-0001',
          journal_code: 'AC',
          journal_name: 'Journal des achats',
          entry_date: '2024-11-25',
          piece_ref: 'FAC-AMZN-2024-156',
          label: 'Achat fournitures bureau - Amazon',
          status: 'draft',
          created_at: '2024-11-25T10:30:00Z',
          lines: [
            { id: '1-1', account_code: '606400', account_name: 'Fournitures administratives', label: 'Fournitures bureau', debit: 250.00, credit: 0 },
            { id: '1-2', account_code: '445660', account_name: 'TVA déductible', label: 'TVA 20%', debit: 50.00, credit: 0 },
            { id: '1-3', account_code: '401000', account_name: 'Fournisseurs', label: 'Amazon EU SARL', debit: 0, credit: 300.00 },
          ],
        },
        {
          id: '2',
          entry_number: 'VE-2024-0045',
          journal_code: 'VE',
          journal_name: 'Journal des ventes',
          entry_date: '2024-11-24',
          piece_ref: 'FAC-2024-0089',
          label: 'Prestation conseil - Dupont Industries',
          status: 'validated',
          created_at: '2024-11-24T14:15:00Z',
          validated_at: '2024-11-24T16:00:00Z',
          lines: [
            { id: '2-1', account_code: '411000', account_name: 'Clients', label: 'Dupont Industries', debit: 4200.00, credit: 0 },
            { id: '2-2', account_code: '706000', account_name: 'Prestations de services', label: 'Conseil stratégique', debit: 0, credit: 3500.00 },
            { id: '2-3', account_code: '445710', account_name: 'TVA collectée', label: 'TVA 20%', debit: 0, credit: 700.00 },
          ],
        },
        {
          id: '3',
          entry_number: 'BQ-2024-0123',
          journal_code: 'BQ',
          journal_name: 'Journal de banque',
          entry_date: '2024-11-23',
          piece_ref: 'VIR-2024112300456',
          label: 'Règlement client - Martin Consulting',
          status: 'posted',
          created_at: '2024-11-23T09:00:00Z',
          validated_at: '2024-11-23T09:30:00Z',
          lines: [
            { id: '3-1', account_code: '512000', account_name: 'Banque', label: 'Crédit Mutuel', debit: 7800.00, credit: 0 },
            { id: '3-2', account_code: '411000', account_name: 'Clients', label: 'Martin Consulting', debit: 0, credit: 7800.00 },
          ],
        },
        {
          id: '4',
          entry_number: 'AC-2024-0002',
          journal_code: 'AC',
          journal_name: 'Journal des achats',
          entry_date: '2024-11-22',
          piece_ref: 'FAC-EDF-NOV24',
          label: 'Facture EDF - Novembre 2024',
          status: 'validated',
          created_at: '2024-11-22T11:00:00Z',
          validated_at: '2024-11-22T11:30:00Z',
          lines: [
            { id: '4-1', account_code: '606100', account_name: 'Électricité', label: 'Consommation nov 2024', debit: 156.50, credit: 0 },
            { id: '4-2', account_code: '445660', account_name: 'TVA déductible', label: 'TVA 20%', debit: 31.30, credit: 0 },
            { id: '4-3', account_code: '401000', account_name: 'Fournisseurs', label: 'EDF', debit: 0, credit: 187.80 },
          ],
        },
        {
          id: '5',
          entry_number: 'OD-2024-0012',
          journal_code: 'OD',
          journal_name: 'Opérations diverses',
          entry_date: '2024-11-20',
          label: 'Provision congés payés - Novembre',
          status: 'posted',
          created_at: '2024-11-20T16:00:00Z',
          validated_at: '2024-11-20T17:00:00Z',
          lines: [
            { id: '5-1', account_code: '641000', account_name: 'Rémunération du personnel', label: 'Provision CP', debit: 2500.00, credit: 0 },
            { id: '5-2', account_code: '428000', account_name: 'Dettes provisionnées', label: 'Provision CP nov', debit: 0, credit: 2500.00 },
          ],
        },
      ];

      setEntries(mockEntries);
    } catch (error) {
      console.error('Error loading journal entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEntry = () => {
    setEditingEntry(null);
    setShowEntryModal(true);
  };

  const handleEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setShowEntryModal(true);
  };

  const handleSaveEntry = async (entryData: Partial<JournalEntry>) => {
    if (entryData.id) {
      // Update existing
      setEntries(prev => prev.map(e =>
        e.id === entryData.id ? { ...e, ...entryData } as JournalEntry : e
      ));
    } else {
      // Create new
      const newEntry: JournalEntry = {
        ...entryData,
        id: Date.now().toString(),
        entry_number: `${entryData.journal_code}-2024-${String(entries.length + 1).padStart(4, '0')}`,
        created_at: new Date().toISOString(),
      } as JournalEntry;
      setEntries(prev => [newEntry, ...prev]);
    }
    setShowEntryModal(false);
  };

  const handleValidateEntry = async (entryId: string) => {
    setEntries(prev => prev.map(e =>
      e.id === entryId
        ? { ...e, status: 'validated' as const, validated_at: new Date().toISOString() }
        : e
    ));
  };

  const handleDeleteEntry = async (entryId: string) => {
    setEntries(prev => prev.filter(e => e.id !== entryId));
  };

  const handleDuplicateEntry = (entry: JournalEntry) => {
    const duplicated: JournalEntry = {
      ...entry,
      id: Date.now().toString(),
      entry_number: `${entry.journal_code}-2024-${String(entries.length + 1).padStart(4, '0')}`,
      entry_date: new Date().toISOString().split('T')[0],
      status: 'draft',
      created_at: new Date().toISOString(),
      validated_at: undefined,
      lines: entry.lines.map(l => ({ ...l, id: `${Date.now()}-${l.id}` })),
    };
    setEntries(prev => [duplicated, ...prev]);
  };

  const handleRefresh = () => {
    loadEntries();
  };

  const handleExport = () => {
    console.log('Exporting journal entries...');
    alert('Export FEC en cours de développement');
  };

  return (
    <div className="min-h-screen bg-[#020617]">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/org/${orgId}/erp/invoices`}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <BookOpen size={24} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Journal Comptable</h1>
                <p className="text-sm text-slate-400">Saisie et consultation des écritures</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <JournalListCard
          entries={entries}
          onAdd={handleAddEntry}
          onEdit={handleEditEntry}
          onValidate={handleValidateEntry}
          onDelete={handleDeleteEntry}
          onDuplicate={handleDuplicateEntry}
          onRefresh={handleRefresh}
          onExport={handleExport}
          isLoading={isLoading}
        />
      </div>

      {/* Entry Modal */}
      <JournalEntryModal
        isOpen={showEntryModal}
        onClose={() => {
          setShowEntryModal(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEntry}
        entry={editingEntry}
        accounts={[]}
        journals={[]}
      />
    </div>
  );
}
