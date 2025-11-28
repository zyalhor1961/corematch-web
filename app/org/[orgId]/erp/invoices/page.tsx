'use client';

import React from 'react';
import PageContainer from '@/components/ui/PageContainer';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InvoicesPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  return (
    <PageContainer
      title="Devis & Factures Clients"
      actions={
        <Button asChild>
          <Link href={`/org/${orgId}/sales/quotes/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Devis
          </Link>
        </Button>
      }
    >
      {/* TODO: Add customer invoices table here */}
      <div className="text-center py-12 text-slate-400">
        <p>Module Devis & Factures Clients</p>
        <p className="text-sm mt-2">Créez et gérez vos devis et factures clients</p>
      </div>
    </PageContainer>
  );
}
