import { NextRequest, NextResponse } from 'next/server';

interface ManualTenderIngestionRequest {
    external_id: string;
    title: string;
    description?: string;
    procedure_type?: string;
    published_at?: string;
    deadline_at?: string;
    cpv_codes?: string[];
    location_city?: string;
    location_region?: string;
    buyer_name?: string;
    buyer_siret?: string;
}

interface ManualTenderIngestionResponse {
    tender_id: string;
    project_id: string | null;
    created_project: boolean;
    reused_project: boolean;
    created_tender: boolean;
    message: string;
}

/**
 * POST /api/shark/tenders/ingest
 *
 * Manually ingest a tender (admin/debug endpoint).
 * Creates a tender record and optionally links it to a project.
 */
export async function POST(request: NextRequest) {
    try {
        const orgId = request.headers.get('X-Org-Id');

        if (!orgId) {
            return NextResponse.json(
                { error: 'Missing X-Org-Id header' },
                { status: 400 }
            );
        }

        const body: ManualTenderIngestionRequest = await request.json();

        // Validate required fields
        if (!body.external_id || !body.title) {
            return NextResponse.json(
                { error: 'external_id and title are required' },
                { status: 400 }
            );
        }

        // Forward to Python service
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

        const response = await fetch(
            `${pythonServiceUrl}/shark/tenders/ingest`,
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
            const text = await response.text();
            console.error('[Shark Tenders] Ingest API error:', text);

            return NextResponse.json(
                { error: 'Failed to ingest tender', details: text },
                { status: response.status }
            );
        }

        const data: ManualTenderIngestionResponse = await response.json();

        return NextResponse.json(data);
    } catch (error) {
        console.error('[Shark Tenders] Ingest API error:', error);

        return NextResponse.json(
            { error: 'Internal server error', details: String(error) },
            { status: 500 }
        );
    }
}
