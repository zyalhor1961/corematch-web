import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const documentId = params.documentId;

    const { data: lines, error } = await supabaseAdmin
      .from('document_lines')
      .select('*')
      .eq('document_id', documentId)
      .order('line_no', { ascending: true });

    if (error) {
      console.error('Error fetching lines:', error);
      return NextResponse.json(
        { error: 'Failed to fetch document lines' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: lines || [],
    });

  } catch (error) {
    console.error('Lines fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lines' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const documentId = params.documentId;
    const body = await request.json();
    const { lineId, updates } = body;

    if (!lineId || !updates) {
      return NextResponse.json(
        { error: 'Missing lineId or updates' },
        { status: 400 }
      );
    }

    // Only allow certain fields to be updated
    const allowedFields = [
      'description', 'sku', 'qty', 'unit', 'unit_price', 'line_amount',
      'hs_code', 'hs_confidence', 'country_of_origin', 'net_mass_kg',
      'weight_confidence', 'shipping_allocated', 'customs_value_line',
      'source_weight', 'source_hs', 'pages_source', 'enrichment_notes'
    ];

    const validUpdates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in updates) {
        validUpdates[field] = updates[field];
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    validUpdates['last_reviewed_at'] = new Date().toISOString();

    // Update the line
    const { data: line, error } = await supabaseAdmin
      .from('document_lines')
      .update(validUpdates)
      .eq('id', lineId)
      .eq('document_id', documentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating line:', error);
      return NextResponse.json(
        { error: 'Failed to update line' },
        { status: 500 }
      );
    }

    // Log the update in audit trail
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        document_id: documentId,
        action: 'update_line',
        before: { line_id: lineId },
        after: validUpdates,
      });

    return NextResponse.json({
      success: true,
      data: line,
    });

  } catch (error) {
    console.error('Line update error:', error);
    return NextResponse.json(
      { error: 'Failed to update line' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const documentId = params.documentId;
    const body = await request.json();
    
    // Add the document_id to the line data
    const lineData = {
      ...body,
      document_id: documentId,
    };

    const { data: line, error } = await supabaseAdmin
      .from('document_lines')
      .insert(lineData)
      .select()
      .single();

    if (error) {
      console.error('Error creating line:', error);
      return NextResponse.json(
        { error: 'Failed to create line' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: line,
    });

  } catch (error) {
    console.error('Line creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create line' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const documentId = params.documentId;
    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get('lineId');

    if (!lineId) {
      return NextResponse.json(
        { error: 'Missing lineId parameter' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('document_lines')
      .delete()
      .eq('id', lineId)
      .eq('document_id', documentId);

    if (error) {
      console.error('Error deleting line:', error);
      return NextResponse.json(
        { error: 'Failed to delete line' },
        { status: 500 }
      );
    }

    // Log the deletion
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        document_id: documentId,
        action: 'delete_line',
        before: { line_id: lineId },
      });

    return NextResponse.json({
      success: true,
      data: { message: 'Line deleted successfully' },
    });

  } catch (error) {
    console.error('Line deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete line' },
      { status: 500 }
    );
  }
}
