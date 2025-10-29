import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/auth-middleware';

export const GET = withAuth(async (request, session) => {
  console.log(`[check-cv-bucket] User ${session.user.id} accessing route`);

  try {
    console.log('[check-cv-bucket] Checking CV bucket configuration...');

    // Test bucket access
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();

    if (bucketsError) {
      return NextResponse.json({
        success: false,
        error: 'Cannot list buckets',
        details: bucketsError.message
      }, { status: 500 });
    }

    const cvBucket = buckets.find(bucket => bucket.name === 'cv');

    if (!cvBucket) {
      return NextResponse.json({
        success: false,
        error: 'CV bucket does not exist',
        buckets: buckets.map(b => b.name)
      }, { status: 404 });
    }

    // Test listing files in CV bucket
    const { data: files, error: filesError } = await supabaseAdmin.storage
      .from('cv')
      .list('', { limit: 10 });

    if (filesError) {
      return NextResponse.json({
        success: false,
        error: 'Cannot list files in CV bucket',
        details: filesError.message,
        bucket: cvBucket
      }, { status: 500 });
    }

    // Test creating a signed URL for the first file (if any)
    let signedUrlTest = null;
    if (files && files.length > 0) {
      const testFile = files[0];
      const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from('cv')
        .createSignedUrl(testFile.name, 60);

      signedUrlTest = {
        success: !signedError,
        error: signedError?.message,
        url: signedData?.signedUrl
      };
    }

    return NextResponse.json({
      success: true,
      bucket: {
        name: cvBucket.name,
        id: cvBucket.id,
        public: cvBucket.public,
        createdAt: cvBucket.created_at,
        updatedAt: cvBucket.updated_at
      },
      filesCount: files?.length || 0,
      sampleFiles: files?.slice(0, 3).map(f => ({
        name: f.name,
        size: f.metadata?.size,
        lastModified: f.metadata?.lastModified
      })) || [],
      signedUrlTest,
      publicUrlExample: files && files.length > 0
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/cv/${files[0].name}`
        : null
    });

  } catch (error) {
    console.error('[check-cv-bucket] CV bucket check error:', error);
    return NextResponse.json({
      success: false,
      error: 'Bucket check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});

export const POST = withAuth(async (request, session) => {
  console.log(`[check-cv-bucket] User ${session.user.id} making bucket public`);

  try {
    console.log('[check-cv-bucket] Making CV bucket public...');

    // Try to make CV bucket public
    const { data, error } = await supabaseAdmin.storage
      .updateBucket('cv', { public: true });

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to make bucket public',
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'CV bucket is now public',
      data
    });

  } catch (error) {
    console.error('[check-cv-bucket] Make bucket public error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update bucket',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});