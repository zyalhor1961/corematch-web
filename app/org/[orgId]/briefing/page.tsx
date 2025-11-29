'use client';

import React from 'react';
import PageContainer from '@/components/ui/PageContainer';
import MorningBriefing from '@/components/dashboard/MorningBriefing';

export default function BriefingPage() {
    return (
        <PageContainer
            title="Morning Briefing"
            subtitle="Votre resume quotidien genere par notre IA"
        >
            <MorningBriefing />
        </PageContainer>
    );
}
