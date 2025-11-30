import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// PUT /api/shark/radar/views/[viewId] - Update a view
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ viewId: string }> }
) {
    try {
        const { viewId } = await params;
        const orgId = request.headers.get('X-Org-Id');
        const userId = request.headers.get('X-User-Id');

        if (!orgId) {
            return NextResponse.json({ error: 'Missing X-Org-Id header' }, { status: 400 });
        }
        if (!userId) {
            return NextResponse.json({ error: 'Missing X-User-Id header' }, { status: 400 });
        }

        const body = await request.json();

        const response = await fetch(`${PYTHON_SERVICE_URL}/shark/radar/views/${viewId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': orgId,
                'X-User-Id': userId,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[API] Failed to update radar view:', error);
            return NextResponse.json({ error: 'Failed to update view' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[API] Error updating radar view:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/shark/radar/views/[viewId] - Delete a view
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ viewId: string }> }
) {
    try {
        const { viewId } = await params;
        const orgId = request.headers.get('X-Org-Id');
        const userId = request.headers.get('X-User-Id');

        if (!orgId) {
            return NextResponse.json({ error: 'Missing X-Org-Id header' }, { status: 400 });
        }
        if (!userId) {
            return NextResponse.json({ error: 'Missing X-User-Id header' }, { status: 400 });
        }

        const response = await fetch(`${PYTHON_SERVICE_URL}/shark/radar/views/${viewId}`, {
            method: 'DELETE',
            headers: {
                'X-Tenant-Id': orgId,
                'X-User-Id': userId,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[API] Failed to delete radar view:', error);
            return NextResponse.json({ error: 'Failed to delete view' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[API] Error deleting radar view:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
