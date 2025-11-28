'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Landmark, ArrowLeft, Upload, Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  ReconciliationSplitView,
  type BankTransaction,
  type MatchSuggestion,
} from '@/components/erp';

export default function BankReconciliationPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bankAccountName, setBankAccountName] = useState('Compte principal');

  useEffect(() => {
    loadTransactions();
  }, [orgId]);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      // In a real app, this would load from erp_bank_transactions table
      // For now, using mock data to demonstrate the UI
      const mockTransactions: BankTransaction[] = [
        {
          id: '1',
          operation_date: '2024-11-25',
          value_date: '2024-11-25',
          amount: 1250.00,
          direction: 'debit',
          label_raw: 'VIR SEPA AMAZON EU SARL',
          label_clean: 'Amazon EU SARL',
          label_category: 'FOURNITURES',
          counterparty_name: 'Amazon EU SARL',
          bank_reference: 'VIR2024112500123',
          reconciliation_status: 'suggested',
          reconciliation_score: 0.92,
        },
        {
          id: '2',
          operation_date: '2024-11-24',
          value_date: '2024-11-24',
          amount: 3500.00,
          direction: 'credit',
          label_raw: 'VIR CLIENT DUPONT INDUSTRIES REF FAC-2024-0089',
          label_clean: 'Dupont Industries',
          label_category: 'REGLEMENT',
          counterparty_name: 'Dupont Industries',
          bank_reference: 'VIR2024112400456',
          reconciliation_status: 'unmatched',
        },
        {
          id: '3',
          operation_date: '2024-11-23',
          value_date: '2024-11-23',
          amount: 89.90,
          direction: 'debit',
          label_raw: 'PRLV EDF SERVICE CLIENT',
          label_clean: 'EDF',
          label_category: 'ENERGIE',
          counterparty_name: 'EDF',
          bank_reference: 'PRLV2024112300789',
          reconciliation_status: 'matched',
          reconciliation_score: 1.0,
        },
        {
          id: '4',
          operation_date: '2024-11-22',
          value_date: '2024-11-22',
          amount: 450.00,
          direction: 'debit',
          label_raw: 'VIR SEPA ORANGE SA FACTURE',
          label_clean: 'Orange SA',
          label_category: 'TELECOM',
          counterparty_name: 'Orange SA',
          bank_reference: 'VIR2024112200321',
          reconciliation_status: 'unmatched',
        },
        {
          id: '5',
          operation_date: '2024-11-21',
          value_date: '2024-11-21',
          amount: 7800.00,
          direction: 'credit',
          label_raw: 'VIR MARTIN CONSULTING PAIEMENT',
          label_clean: 'Martin Consulting',
          label_category: 'REGLEMENT',
          counterparty_name: 'Martin Consulting',
          bank_reference: 'VIR2024112100654',
          reconciliation_status: 'suggested',
          reconciliation_score: 0.85,
        },
        {
          id: '6',
          operation_date: '2024-11-20',
          value_date: '2024-11-20',
          amount: 156.40,
          direction: 'debit',
          label_raw: 'CB STATION SERVICE TOTAL',
          label_clean: 'Total Énergies',
          label_category: 'CARBURANT',
          counterparty_name: 'Total Énergies',
          bank_reference: 'CB2024112000987',
          reconciliation_status: 'unmatched',
        },
      ];

      setTransactions(mockTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSuggestions = async (transactionId: string): Promise<MatchSuggestion[]> => {
    // In a real app, this would call an API to get AI-powered suggestions
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return [];

    // Mock suggestions based on transaction
    if (transaction.direction === 'credit') {
      return [
        {
          id: 'sug-1',
          match_type: 'customer_invoice',
          confidence_score: 0.92,
          match_rule: 'Correspondance nom client + montant',
          matched_entity: {
            id: 'inv-123',
            type: 'invoice',
            reference: 'FAC-2024-0089',
            date: '2024-11-15',
            amount: transaction.amount,
            counterparty_name: transaction.counterparty_name,
          },
        },
      ];
    } else {
      return [
        {
          id: 'sug-2',
          match_type: 'supplier_invoice',
          confidence_score: 0.88,
          match_rule: 'Correspondance fournisseur + période',
          matched_entity: {
            id: 'sinv-456',
            type: 'supplier_invoice',
            reference: 'FOUR-2024-0156',
            date: '2024-11-10',
            amount: transaction.amount,
            counterparty_name: transaction.counterparty_name,
          },
        },
        {
          id: 'sug-3',
          match_type: 'expense',
          confidence_score: 0.65,
          match_rule: 'Catégorie similaire',
          matched_entity: {
            id: 'exp-789',
            type: 'expense',
            reference: 'NOTE-2024-0034',
            date: '2024-11-18',
            amount: transaction.amount * 0.98,
            counterparty_name: transaction.counterparty_name,
          },
        },
      ];
    }
  };

  const handleMatch = async (transactionId: string, suggestionId: string) => {
    // Update transaction status to matched
    setTransactions(prev => prev.map(t =>
      t.id === transactionId
        ? { ...t, reconciliation_status: 'matched' as const, reconciliation_score: 1.0 }
        : t
    ));
    console.log('Matched transaction', transactionId, 'with suggestion', suggestionId);
  };

  const handleReject = async (transactionId: string, suggestionId: string) => {
    console.log('Rejected suggestion', suggestionId, 'for transaction', transactionId);
  };

  const handleIgnore = async (transactionId: string) => {
    setTransactions(prev => prev.map(t =>
      t.id === transactionId
        ? { ...t, reconciliation_status: 'ignored' as const }
        : t
    ));
    console.log('Ignored transaction', transactionId);
  };

  const handleRefresh = async () => {
    await loadTransactions();
  };

  const handleExport = () => {
    // In a real app, this would export to CSV/Excel
    console.log('Exporting reconciliation data...');
    alert('Export CSV en cours de développement');
  };

  return (
    <div className="h-screen flex flex-col bg-[#020617]">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/org/${orgId}/erp/invoices`}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
                  <Landmark size={24} className="text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">Rapprochement Bancaire</h1>
                  <p className="text-sm text-slate-400">Connectez vos transactions aux factures</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <Upload size={16} />
                Importer relevé
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <Download size={16} />
                Exporter
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Split View */}
      <div className="flex-1 overflow-hidden">
        <ReconciliationSplitView
          transactions={transactions}
          onMatch={handleMatch}
          onReject={handleReject}
          onIgnore={handleIgnore}
          onRefresh={handleRefresh}
          onExport={handleExport}
          getSuggestions={getSuggestions}
          isLoading={isLoading}
          bankAccountName={bankAccountName}
        />
      </div>
    </div>
  );
}
