'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Receipt, FileArchive, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  TVADeclarationCard,
  FECExportCard,
  type TVADeclaration,
  type FECExport,
} from '@/components/erp';

type DeclarationTab = 'tva' | 'fec';

export default function DeclarationsPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [activeTab, setActiveTab] = useState<DeclarationTab>('tva');
  const [isLoading, setIsLoading] = useState(true);
  const [tvaDeclaration, setTvaDeclaration] = useState<TVADeclaration | null>(null);
  const [fecExport, setFecExport] = useState<FECExport | null>(null);

  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Mock TVA declaration data (CA3)
      const mockTVA: TVADeclaration = {
        id: '1',
        period: '2024-11',
        period_label: 'Novembre 2024',
        regime: 'mensuel',
        status: 'draft',
        due_date: '2024-12-24',
        operations_imposables: [
          { code: '01', label: 'Ventes, prestations de services', base: 37500 },
          { code: '02', label: 'Autres opérations imposables', base: 0 },
          { code: '03', label: 'Acquisitions intracommunautaires', base: 2500 },
          { code: '04', label: 'Importations', base: 0 },
        ],
        tva_brute: [
          { code: '08', label: 'Taux normal 20%', base: 37500, tva: 7500, highlight: true },
          { code: '09', label: 'Taux réduit 10%', base: 0, tva: 0 },
          { code: '9B', label: 'Taux réduit 5.5%', base: 0, tva: 0 },
          { code: '14', label: 'TVA sur acquisitions intracom.', base: 2500, tva: 500 },
        ],
        tva_deductible: [
          { code: '19', label: 'TVA sur immobilisations', tva: 500 },
          { code: '20', label: 'TVA sur autres biens et services', tva: 2400, highlight: true },
          { code: '21', label: 'Autre TVA déductible', tva: 0 },
          { code: '22', label: 'TVA sur acquisitions intracom.', tva: 500 },
        ],
        tva_nette: 4600,
        credit_precedent: 0,
        tva_a_payer: 4600,
        credit_a_reporter: 0,
        created_at: new Date().toISOString(),
      };

      setTvaDeclaration(mockTVA);

      // Mock FEC export data
      const mockFEC: FECExport = {
        id: '1',
        fiscal_year: '2024',
        company_siren: '123456789',
        company_name: 'Ma Société SAS',
        stats: {
          total_entries: 1247,
          total_lines: 3892,
          total_debit: 458750.45,
          total_credit: 458750.45,
          period_start: '2024-01-01',
          period_end: '2024-11-30',
          is_balanced: true,
          accounts_count: 87,
          journals_count: 6,
        },
        validations: [
          { code: 'FEC-001', label: 'Format des colonnes', status: 'valid' },
          { code: 'FEC-002', label: 'Encodage UTF-8', status: 'valid' },
          { code: 'FEC-003', label: 'Équilibre débit/crédit', status: 'valid' },
          { code: 'FEC-004', label: 'Numérotation des écritures', status: 'valid' },
          { code: 'FEC-005', label: 'Dates dans l\'exercice', status: 'valid' },
          { code: 'FEC-006', label: 'Comptes conformes au PCG', status: 'warning', message: '3 comptes non référencés dans le PCG standard' },
          { code: 'FEC-007', label: 'Libellés obligatoires', status: 'valid' },
          { code: 'FEC-008', label: 'Pièces justificatives', status: 'warning', message: '12 écritures sans référence de pièce' },
        ],
      };

      setFecExport(mockFEC);
    } catch (error) {
      console.error('Error loading declarations data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // TVA handlers
  const handleValidateTVA = async () => {
    if (!tvaDeclaration) return;
    setTvaDeclaration(prev => prev ? { ...prev, status: 'validated', validated_at: new Date().toISOString() } : null);
  };

  const handleSubmitTVA = async () => {
    if (!tvaDeclaration) return;
    setTvaDeclaration(prev => prev ? { ...prev, status: 'submitted', submitted_at: new Date().toISOString() } : null);
  };

  const handleExportTVAPDF = () => {
    console.log('Exporting TVA to PDF...');
    alert('Export PDF en cours de développement');
  };

  const handleExportTVAEDI = () => {
    console.log('Exporting TVA to EDI...');
    alert('Export EDI en cours de développement');
  };

  // FEC handlers
  const handleGenerateFEC = async () => {
    if (!fecExport) return;
    setFecExport(prev => prev ? {
      ...prev,
      generated_at: new Date().toISOString(),
      file_name: `${prev.company_siren}FEC20240101.txt`,
    } : null);
  };

  const handleDownloadFEC = () => {
    console.log('Downloading FEC...');
    alert('Téléchargement FEC en cours de développement');
  };

  const handleValidateFEC = async () => {
    console.log('Revalidating FEC...');
    // In a real app, this would re-run all validations
  };

  const tabs = [
    { id: 'tva' as const, label: 'Déclaration TVA', icon: Receipt },
    { id: 'fec' as const, label: 'Export FEC', icon: FileArchive },
  ];

  return (
    <div className="min-h-screen bg-[#020617]">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/org/${orgId}/erp/invoices`}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <FileText size={24} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Déclarations Fiscales</h1>
                <p className="text-sm text-slate-400">TVA et exports réglementaires</p>
              </div>
            </div>
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
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'tva' && tvaDeclaration && (
          <TVADeclarationCard
            declaration={tvaDeclaration}
            onValidate={handleValidateTVA}
            onSubmit={handleSubmitTVA}
            onExportPDF={handleExportTVAPDF}
            onExportEDI={handleExportTVAEDI}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'fec' && fecExport && (
          <FECExportCard
            exportData={fecExport}
            onGenerate={handleGenerateFEC}
            onDownload={fecExport.generated_at ? handleDownloadFEC : undefined}
            onValidate={handleValidateFEC}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
