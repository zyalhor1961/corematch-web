import { NextRequest, NextResponse } from 'next/server';

// Empty response when service is unavailable
const EMPTY_RESPONSE = {
    items: [],
    page: 1,
    page_size: 20,
    total: 0,
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

        // Build query string for Python service
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
        const queryParams = new URLSearchParams();

        // Forward all search params
        searchParams.forEach((value, key) => {
            queryParams.set(key, value);
        });

        const response = await fetch(
            `${pythonServiceUrl}/shark/projects/top?${queryParams.toString()}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': orgId,
                },
            }
        );

        if (!response.ok) {
            const text = await response.text();
            console.error('Shark API error:', text);

            // Return empty response instead of error for graceful degradation
            // The frontend will show "No projects found"
            return NextResponse.json({
                ...EMPTY_RESPONSE,
                page: parseInt(searchParams.get('page') || '1'),
                page_size: parseInt(searchParams.get('page_size') || '20'),
            });
        }

        const data = await response.json();

        // Map items to match frontend expected format
        // Python API returns: project_id, name, location_city, location_region, phase, estimated_scale, score, priority, organizations_count
        // Frontend expects: id, title, city, department, phase, scale, score, priority, organization_count
        const mappedProjects = (data.items || []).map((item: Record<string, unknown>) => ({
            id: item.project_id || item.id,
            title: item.name || 'Sans nom',
            description: item.description_short || null,
            phase: item.phase || 'etude',
            scale: item.estimated_scale || 'Medium',
            amount_estimate: item.budget_amount || null,
            city: item.location_city || null,
            department: item.location_region || null,
            region: item.location_region || null,
            score: item.score || 0,
            priority: item.priority || 'LOW',
            organization_count: item.organizations_count || 0,
            news_count: item.news_count || 0,
            last_action_at: item.last_updated_at || null,
        }));

        return NextResponse.json({
            projects: mappedProjects,
            total: data.total || 0,
            page: data.page || 1,
            page_size: data.page_size || 20,
        });
    } catch (error) {
        console.error('Shark projects/top API error:', error);

        // Return empty response for graceful degradation
        return NextResponse.json({
            projects: [],
            total: 0,
            page: 1,
            page_size: 20,
        });
    }
}
