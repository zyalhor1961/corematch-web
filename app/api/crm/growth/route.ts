import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/crm/growth
 *
 * Proxy to Python Growth Agent (LeadSniper) for semantic B2B prospect discovery.
 * Uses Exa.ai for semantic search with geographic restrictions.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userBusiness, targetDescription, geography, orgId, excludeDomains, maxResults } = body;

        // Validate required fields
        if (!userBusiness && !targetDescription) {
            return NextResponse.json(
                { error: 'Missing userBusiness or targetDescription' },
                { status: 400 }
            );
        }

        // Call Python Growth Agent service
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

        const response = await fetch(`${pythonServiceUrl}/growth/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_business: targetDescription || userBusiness,
                org_id: orgId || null,
                geography: geography || null,
                exclude_domains: excludeDomains || null,
                max_results: maxResults || 10,
                strict_geo_filter: true,
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

            console.error('Growth Agent service error:', errorData);

            return NextResponse.json(
                { error: errorData.error || errorData.detail || 'Growth Agent service error' },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Transform prospects to match frontend HunterCandidate interface
        const candidates = (data.prospects || []).map((prospect: any, index: number) => ({
            id: `prospect-${index}-${Date.now()}`,
            company_name: prospect.company_name || prospect.title || 'Unknown Company',
            website: prospect.website || prospect.url || '',
            logo_url: prospect.logo_url || `https://logo.clearbit.com/${extractDomain(prospect.website || '')}`,
            match_score: prospect.ai_score || prospect.probability || 50,
            sector: prospect.sector || null,
            city: prospect.detected_city || null,
            ai_summary: prospect.ai_summary || prospect.description?.substring(0, 200) || null,
            buying_signals: prospect.buying_signals || [],
            relationship_type: prospect.relationship_type || 'prospect',
            ai_next_action: prospect.ai_next_action || null,
        }));

        return NextResponse.json({
            success: data.success !== false,
            candidates,
            metadata: data.metadata || {},
        });
    } catch (error) {
        console.error('Growth Agent API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/crm/growth
 *
 * Check if Growth Agent is available (Exa.ai configured)
 */
export async function GET() {
    try {
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

        const response = await fetch(`${pythonServiceUrl}/growth/status`, {
            method: 'GET',
        });

        if (!response.ok) {
            return NextResponse.json({ available: false });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Growth status check error:', error);
        return NextResponse.json({ available: false });
    }
}

// Helper to extract domain from URL
function extractDomain(url: string): string {
    try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        return parsed.hostname.replace('www.', '');
    } catch {
        return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    }
}
