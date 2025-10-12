import { NextRequest, NextResponse } from 'next/server';
import { bulkImportArticles } from '@/lib/services/deb/auto-learning';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, articles, importedBy } = body;

    if (!orgId || !articles || !Array.isArray(articles)) {
      return NextResponse.json(
        { error: 'orgId and articles array are required' },
        { status: 400 }
      );
    }

    console.log(`📥 Importing ${articles.length} articles for org ${orgId}...`);

    const result = await bulkImportArticles(
      orgId,
      articles,
      importedBy || 'system'
    );

    console.log(`✅ Import complete: ${result.imported} imported, ${result.failed} failed`);

    return NextResponse.json({
      success: result.success,
      orgId,
      imported: result.imported,
      failed: result.failed,
      errors: result.errors,
      message: `Imported ${result.imported} articles${result.failed > 0 ? `, ${result.failed} failed` : ''}`
    });

  } catch (error: any) {
    console.error('❌ Import error:', error);
    return NextResponse.json(
      { error: `Failed to import articles: ${error.message}` },
      { status: 500 }
    );
  }
}
