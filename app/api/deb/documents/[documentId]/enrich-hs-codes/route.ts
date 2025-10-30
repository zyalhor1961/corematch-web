import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { enrichHSCodes, getEnrichmentSuggestions } from '@/lib/services/deb/hs-code-enrichment';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const { documentId } = await params;
    const body = await request.json().catch(() => ({}));
    const { forceRefresh = false } = body;

    console.log('🔍 Enriching HS codes for document:', documentId);

    // Fetch document
    const { data: document, error: docError } = await supabaseAdmin
      .from('idp_documents')
      .select('org_id')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check if already enriched (unless force refresh)
    if (!forceRefresh) {
      const existing = await getEnrichmentSuggestions(documentId);
      if (existing.length > 0) {
        console.log('✅ Using existing enrichments');
        return NextResponse.json({
          success: true,
          documentId,
          enrichments: existing,
          cached: true
        });
      }
    }

    // Fetch line items from document
    const { data: fields, error: fieldsError } = await supabaseAdmin
      .from('idp_extracted_fields')
      .select('*')
      .eq('document_id', documentId)
      .eq('field_category', 'line_item');

    if (fieldsError) {
      throw new Error(`Failed to fetch line items: ${fieldsError.message}`);
    }

    if (!fields || fields.length === 0) {
      return NextResponse.json({
        success: true,
        documentId,
        enrichments: [],
        message: 'No line items found to enrich'
      });
    }

    // Convert fields to line items
    const lineItems = fields.map(field => ({
      lineId: field.id,
      description: field.value_text || '',
      sku: field.metadata?.sku,
      quantity: field.value_number || 1,
      unitPrice: field.metadata?.unit_price || 0,
      valueHT: field.metadata?.line_amount || 0
    }));

    // Perform enrichment
    const result = await enrichHSCodes({
      orgId: document.org_id,
      documentId,
      lineItems
    });

    console.log(`✅ Enrichment complete: ${result.summary.fromReferenceDB} from DB, ${result.summary.fromOpenAI} from AI`);

    return NextResponse.json({
      success: true,
      documentId,
      enrichments: result.suggestions,
      summary: result.summary,
      referenceHitRate: result.referenceHitRate,
      cached: false
    });

  } catch (error: any) {
    console.error('❌ HS code enrichment error:', error);
    return NextResponse.json(
      { error: `Failed to enrich HS codes: ${error.message}` },
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

    const suggestions = await getEnrichmentSuggestions(documentId);

    return NextResponse.json({
      success: true,
      documentId,
      enrichments: suggestions,
      count: suggestions.length
    });

  } catch (error: any) {
    console.error('❌ Error fetching enrichments:', error);
    return NextResponse.json(
      { error: `Failed to fetch enrichments: ${error.message}` },
      { status: 500 }
    );
  }
}
