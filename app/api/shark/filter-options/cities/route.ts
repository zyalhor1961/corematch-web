import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// GET /api/shark/filter-options/cities - Get cities for autocomplete
export async function GET(request: NextRequest) {
    try {
        const orgId = request.headers.get('X-Org-Id');
        if (!orgId) {
            return NextResponse.json({ error: 'Missing X-Org-Id header' }, { status: 400 });
        }

        const searchParams = request.nextUrl.searchParams;
        const search = searchParams.get('search');
        const limit = searchParams.get('limit') || '20';

        const params = new URLSearchParams();
        if (search) params.set('search', search);
        params.set('limit', limit);

        const response = await fetch(
            `${PYTHON_SERVICE_URL}/shark/filter-options/cities?${params.toString()}`,
            {
                headers: {
                    'X-Tenant-Id': orgId,
                },
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('[API] Failed to get cities:', error);
            return NextResponse.json({ error: 'Failed to get cities' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[API] Error getting cities:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
