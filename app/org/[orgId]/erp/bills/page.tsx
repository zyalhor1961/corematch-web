'use client';

import React, { useState } from 'react';
import PageContainer from '@/components/ui/PageContainer';
import InvoiceSmartTable from '@/components/Invoices/InvoiceSmartTable';
import UploadZone from '@/components/Invoices/UploadZone';
import { useParams } from 'next/navigation';

export default function BillsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  // Refresh key to force table reload after upload
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <PageContainer
      title="Factures Fournisseurs"
    >
      {/* Upload Zone for AI Ingestion */}
      <UploadZone onUploadComplete={() => setRefreshKey(prev => prev + 1)} />

      {/* Smart Table with filters and column selection */}
      <InvoiceSmartTable key={refreshKey} orgId={orgId} />
    </PageContainer>
  );
}
