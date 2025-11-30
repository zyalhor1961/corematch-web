import { NextRequest, NextResponse } from 'next/server';
import { SharkTender } from '@/types/shark';

// Empty response when service is unavailable
const EMPTY_RESPONSE = {
    items: [] as SharkTender[],
    page: 1,
    page_size: 20,
    total: 0,
};

/**
 * GET /api/shark/tenders/recent
 *
 * Fetches recent public tenders (appels d'offres) for the current tenant.
 *
 * Query params:
 * - days: Number of days to look back (default: 30)
 * - page: Page number (default: 1)
 * - page_size: Items per page (default: 20, max: 100)
 * - status: Filter by tender status (published|awarded|closed|cancelled)
 */
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
            `${pythonServiceUrl}/shark/tenders/recent?${queryParams.toString()}`,
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
            console.error('[Shark Tenders] API error:', text);

            // Return empty response for graceful degradation
            return NextResponse.json({
                ...EMPTY_RESPONSE,
                page: parseInt(searchParams.get('page') || '1'),
                page_size: parseInt(searchParams.get('page_size') || '20'),
            });
        }

        const data = await response.json();

        // Map items to match frontend expected format
        const mappedTenders: SharkTender[] = (data.items || []).map((item: Record<string, unknown>) => ({
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

        return NextResponse.json({
            items: mappedTenders,
            total: data.total || 0,
            page: data.page || 1,
            page_size: data.page_size || 20,
        });
    } catch (error) {
        console.error('[Shark Tenders] Recent API error:', error);

        // Return empty response for graceful degradation
        return NextResponse.json({
            items: [],
            total: 0,
            page: 1,
            page_size: 20,
        });
    }
}
