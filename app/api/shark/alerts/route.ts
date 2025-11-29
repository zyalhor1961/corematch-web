import { NextRequest, NextResponse } from 'next/server';

// Empty response when service is unavailable
const EMPTY_ALERTS = {
    alerts: [],
    unread_count: 0,
    new_critical_projects_count: 0,
    score_changes: [],
    recent_projects: [],
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

        // Forward query params (like unread_only)
        searchParams.forEach((value, key) => {
            queryParams.set(key, value);
        });

        const response = await fetch(
            `${pythonServiceUrl}/shark/alerts?${queryParams.toString()}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': orgId,
                },
            }
        );

        if (!response.ok) {
            console.error('Shark alerts API error:', await response.text());
            // Return empty alerts for graceful degradation
            return NextResponse.json(EMPTY_ALERTS);
        }

        const data = await response.json();
        return NextResponse.json({
            alerts: data.recent_projects || [],
            unread_count: data.new_critical_projects_count || 0,
            ...data,
        });
    } catch (error) {
        console.error('Shark alerts API error:', error);
        // Return empty alerts for graceful degradation
        return NextResponse.json(EMPTY_ALERTS);
    }
}
