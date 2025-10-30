import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { performVATControls } from '@/lib/services/deb/vat-control';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const { documentId } = await params;

    console.log('🔍 Running VAT controls for document:', documentId);

    // Fetch document data
    const { data: document, error: docError } = await supabaseAdmin
      .from('idp_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Extract required financial data
    const netAmount = document.net_amount || 0;
    const taxAmount = document.tax_amount || 0;
    const totalAmount = document.total_amount || 0;

    // Run VAT controls
    const controlResults = await performVATControls({
      documentId,
      netAmount,
      taxAmount,
      totalAmount,
      vendorCountry: document.vendor_country,
      vendorVAT: document.vendor_vat,
      currency: document.currency_code || 'EUR'
    });

    console.log('✅ VAT controls completed:', controlResults.overallStatus);

    return NextResponse.json({
      success: true,
      documentId,
      controls: controlResults,
      needsReview: controlResults.needsManualReview
    });

  } catch (error: any) {
    console.error('❌ VAT control error:', error);
    return NextResponse.json(
      { error: `Failed to run VAT controls: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const { documentId } = await params;

    // Fetch stored VAT control results
    const { data: document, error } = await supabaseAdmin
      .from('idp_documents')
      .select('vat_control_status, vat_control_results, is_intra_eu, vat_regime')
      .eq('id', documentId)
      .single();

    if (error || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      documentId,
      status: document.vat_control_status,
      controls: document.vat_control_results,
      isIntraEU: document.is_intra_eu,
      vatRegime: document.vat_regime
    });

  } catch (error: any) {
    console.error('❌ Error fetching VAT controls:', error);
    return NextResponse.json(
      { error: `Failed to fetch VAT controls: ${error.message}` },
      { status: 500 }
    );
  }
}
