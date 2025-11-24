'use client';

import React, { useState } from 'react';
import PageContainer from '@/components/ui/PageContainer';
import InvoiceListTable from '@/components/Invoices/InvoiceListTable';
import UploadZone from '@/components/Invoices/UploadZone';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InvoicesPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  // Petit trick pour forcer le rafraîchissement du tableau après upload
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <PageContainer
      title="Achats Fournisseurs"
      actions={
        <Button asChild className="bg-teal-500 hover:bg-teal-400 text-white shadow-lg shadow-teal-500/20">
          <Link href={`/org/${orgId}/erp/invoices/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Saisie Manuelle
          </Link>
        </Button>
      }
    >
      {/* 1. La Zone d'Ingestion IA */}
      <UploadZone onUploadComplete={() => setRefreshKey(prev => prev + 1)} />

      {/* 2. Le Tableau (qui se recharge quand refreshKey change) */}
      <InvoiceListTable key={refreshKey} orgId={orgId} />
    </PageContainer>
  );
}
