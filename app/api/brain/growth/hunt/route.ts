import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/brain/growth/hunt
 *
 * Bridge between Frontend and Python LeadSniper (Growth Agent).
 * This endpoint receives hunt parameters from the CRM modal and forwards
 * them to the Python service for Exa.ai semantic search.
 */

interface HuntRequest {
    query: string;        // Business description / target description
    city?: string;        // City filter (e.g., "Lyon")
    region?: string;      // Region filter (e.g., "Rhône-Alpes")
    radius?: number;      // Search radius in km (0-100)
    orgId?: string;       // Organization ID for fetching location from Supabase
    excludeDomains?: string[];
    maxResults?: number;
    searchType?: 'clients' | 'suppliers' | 'partners';  // Type of search
    criteria?: string;    // Optional criteria for refinement
}

interface HunterCandidate {
    id: string;
    company_name: string;
    website: string;
    logo_url: string;
    match_score: number;
    sector?: string;
    city?: string;
    ai_summary?: string;
    buying_signals?: string[];
    ai_next_action?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: HuntRequest = await request.json();
        const { query, city, region, radius = 20, orgId, excludeDomains, maxResults = 10, searchType = 'clients', criteria } = body;

        // Validate required fields
        if (!query?.trim()) {
            return NextResponse.json(
                { error: 'Query (description de la cible) est requis' },
                { status: 400 }
            );
        }

        // Build geography string: "City, Region, France"
        const geoParts: string[] = [];
        if (city?.trim()) geoParts.push(city.trim());
        if (region?.trim()) geoParts.push(region.trim());
        geoParts.push('France'); // Default country
        const geography = geoParts.join(', ');

        // Call Python CRM Hunt endpoint
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

        console.log(`[Hunt] Calling Python service: ${pythonServiceUrl}/crm/hunt`);
        console.log(`[Hunt] Query: "${query}", Geography: "${geography}", Radius: ${radius}km, Type: ${searchType}`);

        const response = await fetch(`${pythonServiceUrl}/crm/hunt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                city: city?.trim() || null,
                region: region?.trim() || null,
                geography,
                radius,  // Search radius in km (0 = city only)
                org_id: orgId || null,
                exclude_domains: excludeDomains || [],
                max_results: maxResults,
                search_type: searchType,  // clients | suppliers | partners
                criteria: criteria || null,  // Additional search criteria
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText || 'Python service error' };
            }

            console.error('[Hunt] Python service error:', errorData);

            // Handle 402 Payment Required (insufficient credits)
            if (response.status === 402) {
                const detail = errorData.detail || {};
                return NextResponse.json(
                    {
                        error: detail.error || 'Insufficient credits',
                        message: detail.message || 'Crédits insuffisants',
                        credits_required: detail.credits_required || 1,
                        credits_balance: detail.credits_balance || 0,
                    },
                    { status: 402 }
                );
            }

            return NextResponse.json(
                {
                    error: errorData.error || errorData.detail || 'Service de recherche indisponible',
                    fallback: true
                },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Transform prospects to frontend HunterCandidate format
        const candidates: HunterCandidate[] = (data.prospects || []).map(
            (prospect: any, index: number) => ({
                id: `hunt-${new Date().getTime()}-${index}`,
                company_name: prospect.company_name || prospect.title || 'Entreprise inconnue',
                website: prospect.website || prospect.url || '',
                logo_url: prospect.logo_url || `https://logo.clearbit.com/${extractDomain(prospect.website || prospect.url || '')}`,
                match_score: prospect.ai_score || prospect.probability || 50,
                sector: prospect.sector || null,
                city: prospect.detected_city || city || null,
                ai_summary: prospect.ai_summary || prospect.description?.substring(0, 200) || null,
                buying_signals: prospect.buying_signals || [],
                ai_next_action: prospect.ai_next_action || null,
            })
        );

        return NextResponse.json({
            success: true,
            candidates,
            search_id: data.search_id || null,
            credits_remaining: data.credits_remaining,
            metadata: {
                query,
                geography,
                total_found: candidates.length,
                ...data.metadata,
            },
        });

    } catch (error) {
        console.error('[Hunt] API error:', error);

        // Return error with fallback flag so frontend can show demo mode
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Erreur interne',
                fallback: true,
                candidates: []
            },
            { status: 500 }
        );
    }
}

// Helper to extract domain from URL
function extractDomain(url: string): string {
    if (!url) return '';
    try {
        const cleaned = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
        return cleaned.split('/')[0];
    } catch {
        return url;
    }
}
