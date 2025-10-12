import { NextRequest, NextResponse } from 'next/server';
import { getLearningStats } from '@/lib/services/deb/auto-learning';

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

    const stats = await getLearningStats(orgId);

    if (!stats) {
      return NextResponse.json({
        success: true,
        orgId,
        stats: {
          totalArticles: 0,
          userValidatedCount: 0,
          aiSuggestedCount: 0,
          avgConfidence: 0,
          totalValidations: 0
        }
      });
    }

    return NextResponse.json({
      success: true,
      orgId,
      stats
    });

  } catch (error: any) {
    console.error('❌ Error fetching learning stats:', error);
    return NextResponse.json(
      { error: `Failed to fetch stats: ${error.message}` },
      { status: 500 }
    );
  }
}
