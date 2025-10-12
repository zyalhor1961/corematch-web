import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Simple test upload to debug the issue
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Test upload started');
    console.log('Content-Type:', request.headers.get('content-type'));
    console.log('Environment check:');
    console.log('- SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING');
    console.log('- SERVICE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');

    // Try to get form data
    const contentType = request.headers.get('content-type');

    if (!contentType?.includes('multipart/form-data')) {
      return NextResponse.json({
        error: 'Content-Type must be multipart/form-data',
        received: contentType
      }, { status: 400 });
    }

    console.log('Attempting to parse FormData...');

    try {
      const formData = await request.formData();
      console.log('FormData parsed successfully');

      const file = formData.get('file') as File | null;
      const orgId = formData.get('orgId') as string | null;

      console.log('File:', file ? `${file.name} (${file.size} bytes)` : 'NO FILE');
      console.log('OrgId:', orgId || 'NO ORG ID');

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Test upload successful',
        file: {
          name: file.name,
          size: file.size,
          type: file.type
        },
        orgId
      });
    } catch (parseError: any) {
      console.error('FormData parse error:', parseError);
      return NextResponse.json({
        error: 'Failed to parse form data',
        details: parseError.message,
        stack: parseError.stack
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Test upload error:', error);
    return NextResponse.json({
      error: error.message || 'Test upload failed',
      stack: error.stack
    }, { status: 500 });
  }
}
