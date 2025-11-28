'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { BookText, Scale, ArrowLeft, ChevronDown, Search } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  AccountLedgerCard,
  TrialBalanceCard,
  type LedgerEntry,
  type AccountInfo,
  type TrialBalanceAccount,
} from '@/components/erp';

type LedgerTab = 'balance' | 'account';

export default function LedgerPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [activeTab, setActiveTab] = useState<LedgerTab>('balance');
  const [isLoading, setIsLoading] = useState(true);
  const [balanceAccounts, setBalanceAccounts] = useState<TrialBalanceAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountInfo | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Mock trial balance data
      const mockBalanceAccounts: TrialBalanceAccount[] = [
        // Class 1 - Capitaux
        { code: '101000', name: 'Capital social', class: 1, opening_debit: 0, opening_credit: 50000, period_debit: 0, period_credit: 0, closing_debit: 0, closing_credit: 50000 },
        { code: '110000', name: 'Report à nouveau', class: 1, opening_debit: 0, opening_credit: 12500, period_debit: 0, period_credit: 0, closing_debit: 0, closing_credit: 12500 },
        // Class 2 - Immobilisations
        { code: '218300', name: 'Matériel bureau et informatique', class: 2, opening_debit: 15000, opening_credit: 0, period_debit: 2500, period_credit: 0, closing_debit: 17500, closing_credit: 0 },
        { code: '281830', name: 'Amort. matériel bureau', class: 2, opening_debit: 0, opening_credit: 3000, period_debit: 0, period_credit: 250, closing_debit: 0, closing_credit: 3250 },
        // Class 4 - Tiers
        { code: '401000', name: 'Fournisseurs', class: 4, opening_debit: 0, opening_credit: 8500, period_debit: 12000, period_credit: 15800, closing_debit: 0, closing_credit: 12300 },
        { code: '411000', name: 'Clients', class: 4, opening_debit: 25000, opening_credit: 0, period_debit: 45000, period_credit: 38000, closing_debit: 32000, closing_credit: 0 },
        { code: '445660', name: 'TVA déductible', class: 4, opening_debit: 1200, opening_credit: 0, period_debit: 2400, period_credit: 0, closing_debit: 3600, closing_credit: 0 },
        { code: '445710', name: 'TVA collectée', class: 4, opening_debit: 0, opening_credit: 4500, period_debit: 0, period_credit: 7500, closing_debit: 0, closing_credit: 12000 },
        // Class 5 - Financiers
        { code: '512000', name: 'Banque', class: 5, opening_debit: 35000, opening_credit: 0, period_debit: 52000, period_credit: 48500, closing_debit: 38500, closing_credit: 0 },
        { code: '530000', name: 'Caisse', class: 5, opening_debit: 500, opening_credit: 0, period_debit: 200, period_credit: 350, closing_debit: 350, closing_credit: 0 },
        // Class 6 - Charges
        { code: '606400', name: 'Fournitures administratives', class: 6, opening_debit: 0, opening_credit: 0, period_debit: 1250, period_credit: 0, closing_debit: 1250, closing_credit: 0 },
        { code: '613200', name: 'Locations immobilières', class: 6, opening_debit: 0, opening_credit: 0, period_debit: 3500, period_credit: 0, closing_debit: 3500, closing_credit: 0 },
        { code: '626000', name: 'Frais postaux et télécom', class: 6, opening_debit: 0, opening_credit: 0, period_debit: 450, period_credit: 0, closing_debit: 450, closing_credit: 0 },
        { code: '641000', name: 'Rémunérations personnel', class: 6, opening_debit: 0, opening_credit: 0, period_debit: 12000, period_credit: 0, closing_debit: 12000, closing_credit: 0 },
        { code: '645000', name: 'Charges sociales', class: 6, opening_debit: 0, opening_credit: 0, period_debit: 5200, period_credit: 0, closing_debit: 5200, closing_credit: 0 },
        // Class 7 - Produits
        { code: '706000', name: 'Prestations de services', class: 7, opening_debit: 0, opening_credit: 0, period_debit: 0, period_credit: 37500, closing_debit: 0, closing_credit: 37500 },
        { code: '707000', name: 'Ventes de marchandises', class: 7, opening_debit: 0, opening_credit: 0, period_debit: 0, period_credit: 0, closing_debit: 0, closing_credit: 0 },
      ];

      setBalanceAccounts(mockBalanceAccounts);
    } catch (error) {
      console.error('Error loading ledger data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccountLedger = async (accountCode: string) => {
    const account = balanceAccounts.find(a => a.code === accountCode);
    if (!account) return;

    setSelectedAccount({
      code: account.code,
      name: account.name,
      type: account.class <= 5 ? (account.class <= 2 ? 'asset' : (account.class === 3 ? 'asset' : (account.closing_debit > 0 ? 'asset' : 'liability'))) : (account.class === 6 ? 'expense' : 'revenue'),
      opening_balance: account.opening_debit - account.opening_credit,
    });

    // Mock ledger entries for the selected account
    const mockEntries: LedgerEntry[] = [];
    let runningBalance = account.opening_debit - account.opening_credit;

    // Generate mock entries
    const dates = ['2024-11-01', '2024-11-05', '2024-11-10', '2024-11-15', '2024-11-20', '2024-11-25'];
    const movements = account.period_debit + account.period_credit;

    if (movements > 0) {
      const numEntries = Math.min(6, Math.ceil(movements / 1000));
      const avgDebit = account.period_debit / numEntries;
      const avgCredit = account.period_credit / numEntries;

      for (let i = 0; i < numEntries; i++) {
        const debit = i % 2 === 0 ? avgDebit : 0;
        const credit = i % 2 === 1 ? avgCredit : 0;
        runningBalance += debit - credit;

        mockEntries.push({
          id: `${accountCode}-${i}`,
          entry_date: dates[i % dates.length],
          journal_code: ['AC', 'VE', 'BQ', 'OD'][i % 4],
          entry_number: `${['AC', 'VE', 'BQ', 'OD'][i % 4]}-2024-${String(i + 1).padStart(4, '0')}`,
          piece_ref: `DOC-${Date.now()}-${i}`,
          label: `Opération ${account.name.toLowerCase()} #${i + 1}`,
          debit,
          credit,
          balance: runningBalance,
          counterpart_accounts: ['512000', '401000', '411000'].filter(c => c !== accountCode).slice(0, 1),
        });
      }
    }

    setLedgerEntries(mockEntries);
    setActiveTab('account');
  };

  const handleAccountClick = (accountCode: string) => {
    loadAccountLedger(accountCode);
  };

  const handleExport = () => {
    console.log('Exporting ledger data...');
    alert('Export en cours de développement');
  };

  const filteredAccounts = accountSearch
    ? balanceAccounts.filter(a =>
        a.code.includes(accountSearch) ||
        a.name.toLowerCase().includes(accountSearch.toLowerCase())
      )
    : balanceAccounts;

  const tabs = [
    { id: 'balance' as const, label: 'Balance Générale', icon: Scale },
    { id: 'account' as const, label: 'Grand Livre', icon: BookText },
  ];

  return (
    <div className="min-h-screen bg-[#020617]">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/org/${orgId}/erp/invoices`}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-indigo-500/20">
                  <Scale size={24} className="text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">Grand Livre & Balance</h1>
                  <p className="text-sm text-slate-400">Consultation des comptes et balances</p>
                </div>
              </div>
            </div>

            {/* Account Selector (for Grand Livre tab) */}
            {activeTab === 'account' && (
              <div className="relative">
                <button
                  onClick={() => setShowAccountSelector(!showAccountSelector)}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 text-slate-300 hover:bg-white/10 transition-colors min-w-[280px]"
                >
                  {selectedAccount ? (
                    <>
                      <span className="font-mono text-cyan-400">{selectedAccount.code}</span>
                      <span className="text-sm truncate">{selectedAccount.name}</span>
                    </>
                  ) : (
                    <span className="text-slate-500">Sélectionner un compte</span>
                  )}
                  <ChevronDown size={14} className="ml-auto" />
                </button>

                {showAccountSelector && (
                  <div className="absolute right-0 z-20 mt-1 w-96 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-white/10">
                      <div className="relative">
                        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                          placeholder="Rechercher un compte..."
                          className="w-full pl-8 pr-2 py-1.5 rounded bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredAccounts.slice(0, 15).map(account => (
                        <button
                          key={account.code}
                          onClick={() => {
                            loadAccountLedger(account.code);
                            setShowAccountSelector(false);
                            setAccountSearch('');
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm hover:bg-white/5 transition-colors flex items-center gap-2",
                            selectedAccount?.code === account.code && "bg-white/10"
                          )}
                        >
                          <span className="font-mono text-cyan-400">{account.code}</span>
                          <span className="text-slate-300 truncate">{account.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all",
                    activeTab === tab.id
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'balance' && (
          <TrialBalanceCard
            accounts={balanceAccounts}
            periodLabel="Novembre 2024"
            onAccountClick={handleAccountClick}
            onExport={handleExport}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'account' && selectedAccount && (
          <AccountLedgerCard
            account={selectedAccount}
            entries={ledgerEntries}
            onExport={handleExport}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'account' && !selectedAccount && (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <BookText size={24} className="text-slate-500" />
            </div>
            <p className="text-slate-400 mb-1">Sélectionnez un compte</p>
            <p className="text-sm text-slate-500">
              Choisissez un compte dans la liste pour afficher son grand livre
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
