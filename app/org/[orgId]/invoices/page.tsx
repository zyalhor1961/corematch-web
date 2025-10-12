import { SimpleInvoiceTable } from '@/app/components/invoices/SimpleInvoiceTable';

interface PageProps {
  params: Promise<{
    orgId: string;
  }>;
}

export default async function InvoicesPage({ params }: PageProps) {
  const { orgId } = await params;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-[1800px] mx-auto">
        <SimpleInvoiceTable orgId={orgId} />
      </div>
    </div>
  );
}
