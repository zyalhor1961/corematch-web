import { NextRequest, NextResponse } from 'next/server';
import { exportReferenceToCSV } from '@/lib/services/deb/auto-learning';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId parameter is required' },
        { status: 400 }
      );
    }

    console.log(`📤 Exporting reference database for org ${orgId}...`);

    const csv = await exportReferenceToCSV(orgId);

    console.log(`✅ Export complete`);

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="deb_reference_${orgId}_${Date.now()}.csv"`
      }
    });

  } catch (error: any) {
    console.error('❌ Export error:', error);
    return NextResponse.json(
      { error: `Failed to export reference: ${error.message}` },
      { status: 500 }
    );
  }
}
