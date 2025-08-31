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

    // Create document record
    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .insert({
        org_id: orgId,
        filename,
        file_path: filePath,
        status: 'uploaded',
        created_by,
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
      .select(`
        *,
        document_lines:document_lines(count)
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: documents, error } = await query;

    if (error) {
      console.error('Error fetching documents:', error);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    // Transform to include line count
    const documentsWithCounts = documents?.map(doc => ({
      ...doc,
      line_count: doc.document_lines?.[0]?.count || 0,
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