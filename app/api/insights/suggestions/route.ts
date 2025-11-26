import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const language = searchParams.get('language') || 'fr';
        const orgId = searchParams.get('orgId');

        if (!orgId) {
            return NextResponse.json({ error: 'Missing orgId parameter' }, { status: 400 });
        }

        // Call Python service
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

        const response = await fetch(`${pythonServiceUrl}/insights/suggestions/${orgId}?language=${language}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            return NextResponse.json(
                { error: errorData.error || 'Python service error' },
                { status: response.status }
            );
        }

        const data = await response.json();

        return NextResponse.json(data);
    } catch (error) {
        console.error('Suggestions API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
