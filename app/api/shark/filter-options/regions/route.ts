import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// GET /api/shark/filter-options/regions - Get regions for filter dropdown
export async function GET(request: NextRequest) {
    try {
        const orgId = request.headers.get('X-Org-Id');
        if (!orgId) {
            return NextResponse.json({ error: 'Missing X-Org-Id header' }, { status: 400 });
        }

        const response = await fetch(
            `${PYTHON_SERVICE_URL}/shark/filter-options/regions`,
            {
                headers: {
                    'X-Tenant-Id': orgId,
                },
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('[API] Failed to get regions:', error);
            return NextResponse.json({ error: 'Failed to get regions' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[API] Error getting regions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
