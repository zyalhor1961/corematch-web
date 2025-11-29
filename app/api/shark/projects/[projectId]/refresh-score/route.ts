import { NextRequest, NextResponse } from 'next/server';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const orgId = request.headers.get('X-Org-Id');

        if (!orgId) {
            return NextResponse.json(
                { error: 'Missing X-Org-Id header' },
                { status: 400 }
            );
        }

        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
        const body = await request.json().catch(() => ({ force_recompute: true }));

        const response = await fetch(
            `${pythonServiceUrl}/shark/projects/${projectId}/refresh-score`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': orgId,
                },
                body: JSON.stringify(body),
            }
        );

        if (!response.ok) {
            console.error('Shark refresh-score API error:', await response.text());
            return NextResponse.json(
                { error: 'Echec du recalcul du score' },
                { status: 500 }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Shark refresh-score API error:', error);
        return NextResponse.json(
            { error: 'Service indisponible' },
            { status: 503 }
        );
    }
}
