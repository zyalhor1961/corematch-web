'use client';

import React from 'react';
import PageContainer from '@/components/ui/PageContainer';
import { SmartDataGrid } from '@/components/BI/SmartDataGrid';
import type { ColumnConfig } from '@/types/data-grid';

/**
 * Exemple : Utilisation du SmartDataGrid
 * 
 * Cette page démontre comment utiliser le composant SmartDataGrid
 * avec des données de factures d'exemple.
 */

// Données d'exemple - remplacer par les vraies données de votre API
const sampleInvoices = [
    {
        id: '1',
        invoice_number: 'FACT-2024-001',
        vendor: 'Amazon Web Services',
        client_name: 'Acme Corp',
        date_issued: '2024-01-15',
        total_amount: 1250.50,
        vat_rate: 20,
        payment_terms: 'Net 30',
        status: 'Payée',
    },
    {
        id: '2',
        invoice_number: 'FACT-2024-002',
        vendor: 'Microsoft Azure',
        client_name: 'TechStart Inc',
        date_issued: '2024-01-20',
        total_amount: 3500.00,
        vat_rate: 20,
        payment_terms: 'Net 30',
        status: 'En attente',
    },
    {
        id: '3',
        invoice_number: 'FACT-2024-003',
        vendor: 'Fournitures de Bureau SA',
        client_name: 'Solutions Globales',
        date_issued: '2024-02-01',
        total_amount: 450.75,
        vat_rate: 20,
        payment_terms: 'Net 15',
        status: 'En retard',
    },
    {
        id: '4',
        invoice_number: 'FACT-2024-004',
        vendor: 'Amazon Web Services',
        client_name: 'Startup Labs',
        date_issued: '2024-02-10',
        total_amount: 2100.00,
        vat_rate: 20,
        payment_terms: 'Net 30',
        status: 'En attente',
    },
    {
        id: '5',
        invoice_number: 'FACT-2024-005',
        vendor: 'Google Cloud',
        client_name: 'Data Analytics LLC',
        date_issued: '2024-02-15',
        total_amount: 5200.00,
        vat_rate: 20,
        payment_terms: 'Net 45',
        status: 'Approuvée',
    },
];

// Définir les configurations de colonnes
const columns: ColumnConfig[] = [
    {
        key: 'invoice_number',
        label: 'N° Facture',
        type: 'string',
        sortable: true,
        filterable: true,
    },
    {
        key: 'vendor',
        label: 'Fournisseur',
        type: 'string',
        sortable: true,
        filterable: true,
    },
    {
        key: 'client_name',
        label: 'Client',
        type: 'string',
        sortable: true,
        filterable: true,
    },
    {
        key: 'date_issued',
        label: 'Date',
        type: 'date',
        sortable: true,
        filterable: true,
        formatter: (value) => new Date(value).toLocaleDateString('fr-FR'),
    },
    {
        key: 'total_amount',
        label: 'Montant',
        type: 'number',
        sortable: true,
        filterable: true,
        formatter: (value) => `${Number(value).toFixed(2)} €`,
    },
    {
        key: 'vat_rate',
        label: 'Taux TVA',
        type: 'number',
        sortable: true,
        filterable: true,
        formatter: (value) => `${value}%`,
    },
    {
        key: 'payment_terms',
        label: 'Conditions de paiement',
        type: 'string',
        sortable: true,
        filterable: true,
    },
    {
        key: 'status',
        label: 'Statut',
        type: 'string',
        sortable: true,
        filterable: true,
    },
];

export default function SmartDataGridExample() {
    const handleNaturalQuery = (query: string) => {
        console.log('Requête en langage naturel:', query);
        // Optionnel : Envoyer à l'agent IA pour un traitement avancé
    };

    return (
        <PageContainer
            title="Rapports & BI"
            subtitle="Grille de données interactive"
        >
            <div className="space-y-6">
                {/* Instructions d'utilisation */}
                <div className="bg-[#0F172A]/60 backdrop-blur-xl border border-white/5 rounded-xl p-6">
                    <h2 className="text-lg font-bold text-white mb-3">Fonctionnalités SmartDataGrid</h2>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li className="flex items-start gap-2">
                            <span className="text-purple-400 mt-0.5">✨</span>
                            <span><strong className="text-slate-300">Langage naturel :</strong> Essayez "grosses dépenses", "récent", ou "en attente"</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-teal-400 mt-0.5">🔍</span>
                            <span><strong className="text-slate-300">Filtrage :</strong> Cliquez sur "Filtrer" pour ajouter des conditions (ex: Montant &gt; 500)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-400 mt-0.5">↕️</span>
                            <span><strong className="text-slate-300">Tri :</strong> Cliquez sur les en-têtes de colonnes pour trier ASC/DESC</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-amber-400 mt-0.5">👁️</span>
                            <span><strong className="text-slate-300">Colonnes :</strong> Basculez la visibilité des colonnes avec le bouton "Colonnes"</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-400 mt-0.5">📥</span>
                            <span><strong className="text-slate-300">Export :</strong> Téléchargez les données filtrées en CSV</span>
                        </li>
                    </ul>
                </div>

                {/* Composant SmartDataGrid */}
                <SmartDataGrid
                    data={sampleInvoices}
                    columns={columns}
                    title="Données de facturation"
                    onNaturalQuery={handleNaturalQuery}
                    enableColumnVisibility={true}
                    enableFiltering={true}
                    enableSorting={true}
                    enableNaturalLanguage={true}
                />
            </div>
        </PageContainer>
    );
}
