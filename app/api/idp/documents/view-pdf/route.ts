import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/**
 * GET /api/idp/documents/view-pdf
 *
 * Returns a signed URL for viewing a PDF document
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { error: 'Path parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Generate signed URL valid for 1 hour
    const { data, error } = await supabase
      .storage
      .from('idp-documents')
      .createSignedUrl(path, 3600);

    if (error || !data) {
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (error: any) {
    console.error('Error generating PDF URL:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF URL' },
      { status: 500 }
    );
  }
}
