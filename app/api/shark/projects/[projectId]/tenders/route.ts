import { NextRequest, NextResponse } from 'next/server';
import { SharkTender } from '@/types/shark';

/**
 * GET /api/shark/projects/[projectId]/tenders
 *
 * Fetches all public tenders linked to a specific project.
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
            `${pythonServiceUrl}/shark/projects/${projectId}/tenders`,
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
            console.error('[Shark Tenders] Project tenders API error:', text);

            // Return empty array for graceful degradation
            if (response.status === 404) {
                return NextResponse.json([]);
            }

            return NextResponse.json(
                { error: 'Failed to fetch project tenders', details: text },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Map items to match frontend expected format
        const mappedTenders: SharkTender[] = (Array.isArray(data) ? data : []).map((item: Record<string, unknown>) => ({
            tender_id: item.tender_id || item.id,
            external_id: item.external_id || '',
            reference: item.reference || null,
            title: item.title || null,
            description: item.description || null,
            procedure_type: item.procedure_type || null,
            published_at: item.published_at || null,
            deadline_at: item.deadline_at || null,
            status: item.status || 'published',
            location_city: item.location_city || null,
            location_region: item.location_region || null,
            location_department: item.location_department || null,
            buyer_name: item.buyer_name || null,
            buyer_siret: item.buyer_siret || null,
            cpv_codes: item.cpv_codes || [],
            awarded_at: item.awarded_at || null,
            awarded_amount: item.awarded_amount || null,
            days_until_deadline: item.days_until_deadline ?? null,
            project_id: item.project_id || null,
            project_name: item.project_name || null,
        }));

        return NextResponse.json(mappedTenders);
    } catch (error) {
        console.error('[Shark Tenders] Project tenders API error:', error);

        // Return empty array for graceful degradation
        return NextResponse.json([]);
    }
}
