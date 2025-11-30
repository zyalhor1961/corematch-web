import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// GET /api/shark/radar/views/default - Get the default view
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

        const response = await fetch(`${PYTHON_SERVICE_URL}/shark/radar/views/default`, {
            headers: {
                'X-Tenant-Id': orgId,
                'X-User-Id': userId,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[API] Failed to get default radar view:', error);
            // Return a synthetic fallback
            return NextResponse.json({
                id: 'default-fallback',
                name: 'Vue par defaut',
                is_default: true,
                filters: {
                    priorities: ['HIGH', 'CRITICAL'],
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[API] Error getting default radar view:', error);
        // Return a synthetic fallback
        return NextResponse.json({
            id: 'default-fallback',
            name: 'Vue par defaut',
            is_default: true,
            filters: {
                priorities: ['HIGH', 'CRITICAL'],
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
    }
}
