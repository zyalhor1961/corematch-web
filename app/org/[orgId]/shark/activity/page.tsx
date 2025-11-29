'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import PageContainer from '@/components/ui/PageContainer';
import SharkTabsNav from '@/components/Shark/SharkTabsNav';
import ActivityFeedClient from './ActivityFeedClient';

export default function SharkActivityPage() {
    const params = useParams();
    const orgId = params.orgId as string;

    return (
        <PageContainer
            title="Historique"
            subtitle="Toutes les activites detectees par notre IA pour vos projets"
        >
            <SharkTabsNav orgId={orgId} />
            <ActivityFeedClient />
        </PageContainer>
    );
}
