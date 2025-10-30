import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { DocumentLine } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const documentId = params.documentId;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    // Get document with lines
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select(`
        *,
        document_lines(*)
      `)
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    if (!document.document_lines?.length) {
      return NextResponse.json(
        { error: 'No lines to export' },
        { status: 404 }
      );
    }

    if (format === 'csv') {
      // Generate DEB-style CSV export
      const headers = [
        'Line No',
        'Description',
        'SKU',
        'Quantity',
        'Unit',
        'Unit Price',
        'Line Amount',
        'HS Code',
        'Country of Origin', 
        'Net Mass (kg)',
        'Shipping Allocated',
        'Customs Value',
        'Source Weight',
        'Source HS',
      ];

      const rows = document.document_lines.map((line: DocumentLine) => [
        line.line_no?.toString() || '',
        line.description || '',
        line.sku || '',
        line.qty?.toString() || '',
        line.unit || '',
        line.unit_price?.toFixed(4) || '',
        line.line_amount?.toFixed(2) || '',
        line.hs_code || '',
        line.country_of_origin || '',
        line.net_mass_kg?.toFixed(3) || '',
        line.shipping_allocated?.toFixed(2) || '',
        line.customs_value_line?.toFixed(2) || '',
        line.source_weight || '',
        line.source_hs || '',
      ]);

      // Add document info header
      const docInfo = [
        `# DEB Export - ${document.filename}`,
        `# Supplier: ${document.supplier_name || 'Unknown'}`,
        `# Invoice: ${document.invoice_number || 'Unknown'}`,
        `# Date: ${document.invoice_date || 'Unknown'}`,
        `# Total HT: ${document.total_ht?.toFixed(2) || '0.00'} ${document.currency || 'EUR'}`,
        `# Shipping: ${document.shipping_total?.toFixed(2) || '0.00'} ${document.currency || 'EUR'}`,
        `# Generated: ${new Date().toISOString()}`,
        '',
      ];

      const csvContent = [
        ...docInfo,
        headers.join(';'), // Use semicolon for European CSV format
        ...rows.map(row => 
          row.map(field => 
            typeof field === 'string' && (field.includes(';') || field.includes('"') || field.includes('\n'))
              ? `"${field.replace(/"/g, '""')}"`
              : field
          ).join(';')
        )
      ].join('\n');

      // Store export file
      const exportFilename = `${document.filename.replace(/\.[^/.]+$/, '')}_DEB_export_${new Date().toISOString().split('T')[0]}.csv`;
      const exportPath = `deb-exports/${document.org_id}/${exportFilename}`;

      // Upload CSV to storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from('deb-exports')
        .upload(exportPath, csvContent, {
          contentType: 'text/csv; charset=utf-8',
          metadata: {
            documentId,
            exportedAt: new Date().toISOString(),
          }
        });

      if (uploadError) {
        console.error('Error uploading export:', uploadError);
      } else {
        // Update document with export URL
        await supabaseAdmin
          .from('documents')
          .update({
            export_url: exportPath,
            status: document.status === 'approved' ? 'exported' : document.status,
          })
          .eq('id', documentId);
      }

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${exportFilename}"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      success: true,
      data: {
        document: {
          id: document.id,
          filename: document.filename,
          supplier_name: document.supplier_name,
          supplier_vat: document.supplier_vat,
          supplier_country: document.supplier_country,
          invoice_number: document.invoice_number,
          invoice_date: document.invoice_date,
          currency: document.currency,
          incoterm: document.incoterm,
          total_ht: document.total_ht,
          shipping_total: document.shipping_total,
        },
        lines: document.document_lines,
        exported_at: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}