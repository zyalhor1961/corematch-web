'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PageContainer from '@/components/ui/PageContainer';

export default function OrganizationDashboard() {
    const params = useParams();
    const [userName, setUserName] = useState('User');
    const orgId = params?.orgId as string;

    return (
        <PageContainer
            title="Tableau de bord"
            actions={
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white/5 text-slate-200 rounded-lg border border-white/10 text-sm font-medium hover:bg-white/10 transition-colors">
                        Personnaliser
                    </button>
                </div>
            }
        >
            <div className="space-y-8">
                <div>
                    <h2 className="text-xl font-medium text-slate-400">
                        Bonjour, <span className="text-white capitalize">{userName}</span>.
                    </h2>
                    <p className="text-slate-500 mt-1 text-sm">
                        Test minimal - orgId: {orgId}
                    </p>
                </div>
            </div>
        </PageContainer>
    );
}
