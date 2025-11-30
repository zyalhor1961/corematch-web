/**
 * POST /api/shark/from-sourcing
 *
 * Proxy route to send articles from Sourcing to Shark Hunter for ingestion.
 * When a user clicks "Ajouter au radar" in the Sourcing page, this route:
 * 1. Validates the input
 * 2. Forwards the request to Python service
 * 3. Returns the ingestion result
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SharkFromSourcingRequest, SharkFromSourcingResponse } from '@/types/shark';

/**
 * Validate URL format
 */
function isValidUrl(urlString: string): boolean {
    try {
        const url = new URL(urlString);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

export async function POST(request: NextRequest) {
    try {
        // 1. Get orgId from header (consistent with other Shark routes)
        const orgId = request.headers.get('X-Org-Id');

        if (!orgId) {
            return NextResponse.json(
                {
                    status: 'error',
                    project_id: null,
                    news_id: null,
                    created_project: false,
                    reused_existing_project: false,
                    message: 'Missing X-Org-Id header'
                } as SharkFromSourcingResponse,
                { status: 400 }
            );
        }

        // Validate orgId format (UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(orgId)) {
            return NextResponse.json(
                {
                    status: 'error',
                    project_id: null,
                    news_id: null,
                    created_project: false,
                    reused_existing_project: false,
                    message: 'Invalid X-Org-Id format (expected UUID)'
                } as SharkFromSourcingResponse,
                { status: 400 }
            );
        }

        // 2. Parse and validate body
        let body: SharkFromSourcingRequest;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    status: 'error',
                    project_id: null,
                    news_id: null,
                    created_project: false,
                    reused_existing_project: false,
                    message: 'Invalid JSON body'
                } as SharkFromSourcingResponse,
                { status: 400 }
            );
        }

        // Validate sourceUrl is present and valid
        if (!body.sourceUrl || typeof body.sourceUrl !== 'string') {
            return NextResponse.json(
                {
                    status: 'error',
                    project_id: null,
                    news_id: null,
                    created_project: false,
                    reused_existing_project: false,
                    message: 'sourceUrl is required'
                } as SharkFromSourcingResponse,
                { status: 400 }
            );
        }

        if (!isValidUrl(body.sourceUrl)) {
            return NextResponse.json(
                {
                    status: 'error',
                    project_id: null,
                    news_id: null,
                    created_project: false,
                    reused_existing_project: false,
                    message: 'sourceUrl must be a valid HTTP/HTTPS URL'
                } as SharkFromSourcingResponse,
                { status: 400 }
            );
        }

        // 3. Build payload for Python service
        const pythonPayload = {
            tenant_id: orgId,
            source_url: body.sourceUrl,
            source_name: body.sourceName || null,
            title_hint: body.title || null,
            snippet_hint: body.snippet || null,
        };

        // 4. Call Python backend
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

        console.log(`[SharkFromSourcing] Sending to Python: ${pythonServiceUrl}/shark/ingest-from-sourcing`);
        console.log(`[SharkFromSourcing] Payload: tenant=${orgId}, url=${body.sourceUrl}`);

        const pythonResponse = await fetch(
            `${pythonServiceUrl}/shark/ingest-from-sourcing`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': orgId,
                },
                body: JSON.stringify(pythonPayload),
                // 60 second timeout for scraping + extraction
                signal: AbortSignal.timeout(60000),
            }
        );

        // 5. Handle Python response
        if (!pythonResponse.ok) {
            const errorText = await pythonResponse.text();
            console.error(`[SharkFromSourcing] Python error ${pythonResponse.status}: ${errorText}`);

            return NextResponse.json(
                {
                    status: 'error',
                    project_id: null,
                    news_id: null,
                    created_project: false,
                    reused_existing_project: false,
                    message: `Ingestion failed: ${pythonResponse.status}`
                } as SharkFromSourcingResponse,
                { status: 502 }
            );
        }

        const pythonData = await pythonResponse.json();

        // 6. Format and return response
        const response: SharkFromSourcingResponse = {
            status: 'ok',
            project_id: pythonData.project_id || null,
            news_id: pythonData.news_id || null,
            created_project: pythonData.created_project || false,
            reused_existing_project: pythonData.reused_existing_project || false,
            message: pythonData.message || 'ingestion_completed',
        };

        console.log(`[SharkFromSourcing] Success: project_id=${response.project_id}, created=${response.created_project}`);

        return NextResponse.json(response);

    } catch (error) {
        console.error('[SharkFromSourcing] Unexpected error:', error);

        // Handle timeout specifically
        if (error instanceof Error && error.name === 'TimeoutError') {
            return NextResponse.json(
                {
                    status: 'error',
                    project_id: null,
                    news_id: null,
                    created_project: false,
                    reused_existing_project: false,
                    message: 'Request timeout - ingestion took too long'
                } as SharkFromSourcingResponse,
                { status: 504 }
            );
        }

        return NextResponse.json(
            {
                status: 'error',
                project_id: null,
                news_id: null,
                created_project: false,
                reused_existing_project: false,
                message: 'Internal server error'
            } as SharkFromSourcingResponse,
            { status: 500 }
        );
    }
}
