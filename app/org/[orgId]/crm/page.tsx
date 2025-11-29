'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

/**
 * CRM Index Page - Redirects to Sourcing (main CRM feature)
 */
export default function CRMPage() {
    const router = useRouter();
    const params = useParams();
    const orgId = params.orgId as string;

    useEffect(() => {
        // Redirect to sourcing page (Hunter Mode)
        router.replace(`/org/${orgId}/crm/sourcing`);
    }, [router, orgId]);

    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Redirection vers CRM Sourcing...</div>
        </div>
    );
}
