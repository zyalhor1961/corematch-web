import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// GET /api/shark/radar/views - List all views for user
export async function GET(request: NextRequest) {
    try {
        const orgId = request.headers.get('X-Org-Id');
        const userId = request.headers.get('X-User-Id');

        if (!orgId) {
            return NextResponse.json({ error: 'Missing X-Org-Id header' }, { status: 400 });
        }
        if (!userId) {
            return NextResponse.json({ error: 'Missing X-User-Id header' }, { status: 400 });
        }

        const response = await fetch(`${PYTHON_SERVICE_URL}/shark/radar/views`, {
            headers: {
                'X-Tenant-Id': orgId,
                'X-User-Id': userId,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[API] Failed to list radar views:', error);
            return NextResponse.json({ views: [] });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[API] Error listing radar views:', error);
        return NextResponse.json({ views: [] });
    }
}

// POST /api/shark/radar/views - Create a new view
export async function POST(request: NextRequest) {
    try {
        const orgId = request.headers.get('X-Org-Id');
        const userId = request.headers.get('X-User-Id');

        if (!orgId) {
            return NextResponse.json({ error: 'Missing X-Org-Id header' }, { status: 400 });
        }
        if (!userId) {
            return NextResponse.json({ error: 'Missing X-User-Id header' }, { status: 400 });
        }

        const body = await request.json();

        const response = await fetch(`${PYTHON_SERVICE_URL}/shark/radar/views`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': orgId,
                'X-User-Id': userId,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[API] Failed to create radar view:', error);
            return NextResponse.json({ error: 'Failed to create view' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[API] Error creating radar view:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
