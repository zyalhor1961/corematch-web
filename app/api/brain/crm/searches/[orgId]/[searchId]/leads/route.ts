import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/brain/crm/searches/[orgId]/[searchId]/leads
 *
 * Fetch all sourced leads for a specific search.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string; searchId: string }> }
) {
    try {
        const { orgId, searchId } = await params;
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

        const response = await fetch(
            `${pythonServiceUrl}/crm/searches/${orgId}/${searchId}/leads`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            }
        );

        if (!response.ok) {
            const error = await response.text();
            return NextResponse.json(
                { error: error || 'Failed to fetch sourced leads' },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('[Sourced Leads API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
