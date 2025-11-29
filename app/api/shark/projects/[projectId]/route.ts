import { NextRequest, NextResponse } from 'next/server';

export async function GET(
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

        const response = await fetch(
            `${pythonServiceUrl}/shark/projects/${projectId}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': orgId,
                },
            }
        );

        if (!response.ok) {
            console.error('Shark project detail API error:', await response.text());
            return NextResponse.json(
                { error: 'Projet non trouve' },
                { status: 404 }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Shark project detail API error:', error);
        return NextResponse.json(
            { error: 'Service indisponible' },
            { status: 503 }
        );
    }
}

