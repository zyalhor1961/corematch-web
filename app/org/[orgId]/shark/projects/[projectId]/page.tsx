'use client';

import React from 'react';
import PageContainer from '@/components/ui/PageContainer';
import SharkTabsNav from '@/components/Shark/SharkTabsNav';
import ProjectDetailClient from './ProjectDetailClient';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SharkProjectDetailPage() {
    const params = useParams();
    const orgId = params.orgId as string;

    return (
        <PageContainer
            title="Fiche Projet"
            subtitle="Details du projet et acteurs cles"
            actions={
                <Link
                    href={`/org/${orgId}/shark/radar`}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-xl border border-white/10 transition-all"
                >
                    <ArrowLeft size={18} />
                    Retour au Radar
                </Link>
            }
        >
            <SharkTabsNav orgId={orgId} />
            <ProjectDetailClient />
        </PageContainer>
    );
}
