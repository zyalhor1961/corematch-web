import { NextRequest, NextResponse } from 'next/server';

// Empty response when service is unavailable
const EMPTY_RESPONSE = {
    items: [],
};

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const orgId = request.headers.get('X-Org-Id');

        if (!orgId) {
            return NextResponse.json(
                { error: 'Missing X-Org-Id header' },
                { status: 400 }
            );
        }

        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
        const queryParams = new URLSearchParams();

        // Forward query params
        const projectId = searchParams.get('project_id');
        const limit = searchParams.get('limit');
        const since = searchParams.get('since');

        if (projectId) queryParams.set('project_id', projectId);
        if (limit) queryParams.set('limit', limit);
        if (since) queryParams.set('since', since);

        const response = await fetch(
            `${pythonServiceUrl}/shark/activity-feed?${queryParams.toString()}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': orgId,
                },
            }
        );

        if (!response.ok) {
            console.error('Shark activity API error:', await response.text());
            // Return empty response for graceful degradation
            return NextResponse.json(EMPTY_RESPONSE);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Shark activity API error:', error);
        // Return empty response for graceful degradation
        return NextResponse.json(EMPTY_RESPONSE);
    }
}
