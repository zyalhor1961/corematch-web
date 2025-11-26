import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { result, query, orgName, format } = body;

        if (!result || !query || !format) {
            return NextResponse.json(
                { error: 'Missing required fields: result, query, format' },
                { status: 400 }
            );
        }

        // Call Python service
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

        const response = await fetch(`${pythonServiceUrl}/insights/export`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                result,
                query,
                org_name: orgName || 'Organization',
                format,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            return NextResponse.json(
                { error: errorData.error || 'Export failed' },
                { status: response.status }
            );
        }

        const data = await response.json();

        return NextResponse.json(data);
    } catch (error) {
        console.error('Export API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
