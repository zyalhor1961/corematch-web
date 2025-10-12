import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Ultra-simple test to see if FormData reaches the server
 */
export async function POST(request: NextRequest) {
  console.log('=== TEST FORM ENDPOINT HIT ===');
  console.log('Headers:', JSON.stringify(Object.fromEntries(request.headers.entries())));

  try {
    console.log('Attempting to read FormData...');
    const formData = await request.formData();
    console.log('FormData read successfully!');

    const entries: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        entries[key] = {
          type: 'File',
          name: value.name,
          size: value.size,
          mimeType: value.type
        };
      } else {
        entries[key] = value;
      }
    }

    console.log('FormData entries:', JSON.stringify(entries, null, 2));

    return NextResponse.json({
      success: true,
      message: 'FormData received successfully',
      entries
    });
  } catch (error: any) {
    console.error('Error reading FormData:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
      name: error.name
    }, { status: 500 });
  }
}
