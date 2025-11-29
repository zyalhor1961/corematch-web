'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import PageContainer from '@/components/ui/PageContainer';
import SharkTabsNav from '@/components/Shark/SharkTabsNav';
import SharkRadarClient from './SharkRadarClient';

export default function SharkRadarPage() {
    const params = useParams();
    const orgId = params.orgId as string;

    return (
        <PageContainer
            title="Opportunites"
            subtitle="Projets detectes automatiquement par notre IA - nous cherchons, vous signez"
        >
            <SharkTabsNav orgId={orgId} />
            <SharkRadarClient />
        </PageContainer>
    );
}
