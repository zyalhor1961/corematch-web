'use client';

import React from 'react';
import PageContainer from '@/components/ui/PageContainer';
import InvoiceListTable from '@/components/Invoices/InvoiceListTable';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InvoicesPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  return (
    <PageContainer
      title="Factures"
      actions={
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20">
          <Link href={`/org/${orgId}/erp/invoices/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle facture
          </Link>
        </Button>
      }
    >
      <InvoiceListTable orgId={orgId} />
    </PageContainer>
  );
}
