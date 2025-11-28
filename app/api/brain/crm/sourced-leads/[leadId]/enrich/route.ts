import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/brain/crm/sourced-leads/[leadId]/enrich
 *
 * Enrich a sourced lead with Firecrawl and convert it to a CRM lead.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ leadId: string }> }
) {
    try {
        const { leadId } = await params;
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

        console.log(`[Enrich API] Enriching sourced lead: ${leadId}`);

        const response = await fetch(
            `${pythonServiceUrl}/crm/sourced-leads/${leadId}/enrich-and-convert`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { detail: errorText };
            }

            console.error('[Enrich API] Error:', errorData);
            return NextResponse.json(
                { error: errorData.detail || errorData.error || 'Enrichment failed' },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('[Enrich API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
