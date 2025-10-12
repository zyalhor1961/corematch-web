import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/**
 * GET /api/idp/documents/[documentId]/fields
 *
 * Get all extracted fields for a document with bounding boxes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all extracted fields with bounding boxes
    const { data, error } = await supabase
      .from('idp_extracted_fields')
      .select('*')
      .eq('document_id', documentId)
      .order('page_number', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching fields:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch fields' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('Error in fields API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
