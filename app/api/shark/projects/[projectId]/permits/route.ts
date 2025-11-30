import { NextRequest, NextResponse } from 'next/server';
import { SharkPermit } from '@/types/shark';

/**
 * GET /api/shark/projects/[projectId]/permits
 *
 * Fetches all building permits linked to a specific project.
 */
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

        if (!projectId) {
            return NextResponse.json(
                { error: 'Missing projectId parameter' },
                { status: 400 }
            );
        }

        // Forward to Python service
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

        const response = await fetch(
            `${pythonServiceUrl}/shark/projects/${projectId}/permits`,
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
            console.error('[Shark Permits] Project permits API error:', text);

            // Return empty array for graceful degradation
            if (response.status === 404) {
                return NextResponse.json([]);
            }

            return NextResponse.json(
                { error: 'Failed to fetch project permits', details: text },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Map items to match frontend expected format
        const mappedPermits: SharkPermit[] = (Array.isArray(data) ? data : []).map((item: Record<string, unknown>) => ({
            permit_id: (item.permit_id || item.id) as string,
            external_id: (item.external_id || '') as string,
            reference: (item.reference || null) as string | undefined,
            permit_type: (item.permit_type || null) as string | undefined,
            status: (item.status || 'filed') as SharkPermit['status'],
            applicant_name: (item.applicant_name || null) as string | undefined,
            project_address: (item.project_address || null) as string | undefined,
            city: (item.city || null) as string | undefined,
            postcode: (item.postcode || null) as string | undefined,
            region: (item.region || null) as string | undefined,
            country: (item.country || 'FR') as string,
            description: (item.description || null) as string | undefined,
            estimated_surface: (item.estimated_surface || null) as number | undefined,
            estimated_units: (item.estimated_units || null) as number | undefined,
            submission_date: (item.submission_date || null) as string | undefined,
            decision_date: (item.decision_date || null) as string | undefined,
            project_id: (item.project_id || null) as string | undefined,
            project_name: (item.project_name || null) as string | undefined,
        }));

        return NextResponse.json(mappedPermits);
    } catch (error) {
        console.error('[Shark Permits] Project permits API error:', error);

        // Return empty array for graceful degradation
        return NextResponse.json([]);
    }
}
