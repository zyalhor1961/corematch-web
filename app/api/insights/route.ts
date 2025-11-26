import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { query, orgId } = await request.json();

        if (!query || !orgId) {
            return NextResponse.json(
                { error: 'Missing query or orgId' },
                { status: 400 }
            );
        }

        // Call Python service
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

        const response = await fetch(`${pythonServiceUrl}/insights`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                org_id: orgId,
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(text);
            } catch {
                errorData = { error: text || 'Unknown error from Python service' };
            }

            console.error('Python service error:', errorData);

            return NextResponse.json(
                { error: errorData.error || errorData.detail || 'Python service error' },
                { status: response.status }
            );
        }

        const data = await response.json();

        return NextResponse.json(data);
    } catch (error) {
        console.error('Insights API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
