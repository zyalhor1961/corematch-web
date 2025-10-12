import { NextRequest, NextResponse } from 'next/server';
import { getArticleReference, deleteArticleReference, searchSimilarArticles } from '@/lib/services/deb/auto-learning';

// GET - List articles with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') as 'confidence' | 'validations' | 'recent' | undefined;
    const minConfidence = searchParams.get('minConfidence') ? parseFloat(searchParams.get('minConfidence')!) : undefined;
    const search = searchParams.get('search');

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId parameter is required' },
        { status: 400 }
      );
    }

    // If search query provided, use similar search
    if (search) {
      const similar = await searchSimilarArticles(orgId, search, limit);
      return NextResponse.json({
        success: true,
        orgId,
        articles: similar,
        total: similar.length,
        search: true
      });
    }

    const result = await getArticleReference(orgId, {
      limit,
      offset,
      sortBy,
      minConfidence
    });

    return NextResponse.json({
      success: true,
      orgId,
      articles: result.articles,
      total: result.total,
      limit,
      offset
    });

  } catch (error: any) {
    console.error('❌ Error fetching articles:', error);
    return NextResponse.json(
      { error: `Failed to fetch articles: ${error.message}` },
      { status: 500 }
    );
  }
}

// DELETE - Remove an article
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const articleId = searchParams.get('articleId');

    if (!orgId || !articleId) {
      return NextResponse.json(
        { error: 'orgId and articleId parameters are required' },
        { status: 400 }
      );
    }

    const result = await deleteArticleReference(orgId, articleId);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      articleId
    });

  } catch (error: any) {
    console.error('❌ Error deleting article:', error);
    return NextResponse.json(
      { error: `Failed to delete article: ${error.message}` },
      { status: 500 }
    );
  }
}
