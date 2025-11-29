'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import PageContainer from '@/components/ui/PageContainer';
import SharkTabsNav from '@/components/Shark/SharkTabsNav';
import SharkAlertsClient from './SharkAlertsClient';

export default function SharkAlertsPage() {
    const params = useParams();
    const orgId = params.orgId as string;

    return (
        <PageContainer
            title="Alertes"
            subtitle="Soyez averti des que de nouvelles opportunites importantes sont detectees"
        >
            <SharkTabsNav orgId={orgId} />
            <SharkAlertsClient />
        </PageContainer>
    );
}
