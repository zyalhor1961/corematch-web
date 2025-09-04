import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

const createDocumentSchema = z.object({
  orgId: z.string().uuid(),
  filename: z.string().min(1),
  created_by: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, filename, created_by } = createDocumentSchema.parse(body);

    // Generate unique file path
    const fileExt = filename.split('.').pop();
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `deb-docs/${orgId}/${uniqueFilename}`;

    // Create document record (adapting to existing documents table structure)
    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .insert({
        org_id: orgId,
        name: filename,
        description: `Document DEB uploadé: ${filename}`,
        file_url: filePath,
        file_type: 'application/pdf',
        uploaded_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating document:', error);
      return NextResponse.json(
        { error: 'Failed to create document' },
        { status: 500 }
      );
    }

    // Generate signed upload URL
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from('deb-docs')
      .createSignedUploadUrl(filePath, {
        upsert: true,
      });

    if (urlError || !signedUrlData) {
      console.error('Error creating signed URL:', urlError);
      return NextResponse.json(
        { error: 'Failed to generate upload URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        document,
        uploadUrl: signedUrlData.signedUrl,
      },
    });

  } catch (error) {
    console.error('Document creation error:', error);
    return NextResponse.json(
      { error: 'Invalid request data' },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const status = searchParams.get('status');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing orgId parameter' },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from('documents')
      .select('id, org_id, name, description, file_url, file_type, file_size, created_at, updated_at')
      .eq('org_id', orgId)
      .eq('file_type', 'application/pdf') // Only get PDF documents for DEB
      .order('created_at', { ascending: false });

    const { data: documents, error } = await query;

    if (error) {
      console.error('Error fetching documents:', error);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    // Transform to match expected DEB format
    const documentsWithCounts = documents?.map(doc => ({
      id: doc.id,
      org_id: doc.org_id,
      filename: doc.name,
      supplier_name: null,
      supplier_vat: null,
      invoice_number: null,
      status: 'uploaded',
      pages_count: 0,
      line_count: 0,
      created_at: doc.created_at,
      export_url: null
    })) || [];

    return NextResponse.json({
      success: true,
      data: documentsWithCounts,
    });

  } catch (error) {
    console.error('Documents fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}