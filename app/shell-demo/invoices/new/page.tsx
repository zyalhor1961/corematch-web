
"use client";

import React from 'react';
import PageContainer from '@/components/ui/PageContainer';
import { ArrowLeft, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NewInvoicePage() {
    const router = useRouter();

    return (
        <PageContainer
            title="Nouvelle Facture"
            actions={
                <>
                    <button
                        onClick={() => router.back()}
                        className="p-2 text-slate-400 hover:text-white transition-colors mr-2"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <button className="flex items-center px-4 py-2 bg-neon-teal text-navy-glass font-bold rounded-lg hover:bg-neon-teal/90 transition-colors shadow-[0_0_15px_rgba(0,180,216,0.3)]">
                        <Save className="w-4 h-4 mr-2" />
                        Enregistrer
                    </button>
                </>
            }
        >
            <div className="p-8 text-center border border-dashed border-white/10 rounded-lg">
                <p className="text-slate-400">Formulaire de Nouvelle Facture (Placeholder)</p>
                <p className="text-xs text-slate-500 mt-2">Navigation Réussie</p>
            </div>
        </PageContainer>
    );
}
