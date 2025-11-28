import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/brain/crm/deep-enrich
 *
 * Deep Enrichment for Hunter Mode - Triggered when user selects a prospect.
 * This endpoint proxies to the Python service which:
 * 1. Scrapes the website with Firecrawl
 * 2. Extracts CEO name, contact email, LinkedIn via OpenAI
 * 3. Calculates a win probability score (0-100)
 * 4. Generates a strategic summary and next action
 */

interface DeepEnrichRequest {
    url: string;                    // Website URL to analyze
    userBusinessContext: string;    // What the user sells (for scoring)
    candidateCity?: string;         // City from Hunter results
    candidateSector?: string;       // Sector from Hunter results
}

interface DeepEnrichResponse {
    success: boolean;
    error?: string;
    // Contact Info
    ceo_name?: string;
    contact_email?: string;
    contact_phone?: string;
    linkedin_url?: string;
    // Score & Intelligence
    probability_score: number;
    ai_summary: string;
    ai_next_action?: string;
    // Additional context
    sector?: string;
    headquarters?: string;
    employee_count?: string;
    buying_signals?: string[];
    // UI helpers
    logo_url?: string;
    website?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: DeepEnrichRequest = await request.json();
        const { url, userBusinessContext, candidateCity, candidateSector } = body;

        // Validate required fields
        if (!url?.trim()) {
            return NextResponse.json(
                { error: 'URL est requis', success: false },
                { status: 400 }
            );
        }

        if (!userBusinessContext?.trim()) {
            return NextResponse.json(
                { error: 'Contexte business est requis', success: false },
                { status: 400 }
            );
        }

        // Call Python Deep Enrich endpoint
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

        console.log(`[DeepEnrich] Calling Python service: ${pythonServiceUrl}/crm/deep-enrich`);
        console.log(`[DeepEnrich] URL: "${url}", Business: "${userBusinessContext}"`);

        const response = await fetch(`${pythonServiceUrl}/crm/deep-enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url.trim(),
                user_business_context: userBusinessContext.trim(),
                candidate_city: candidateCity?.trim() || null,
                candidate_sector: candidateSector?.trim() || null,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { detail: errorText || 'Python service error' };
            }

            console.error('[DeepEnrich] Python service error:', errorData);
            return NextResponse.json(
                {
                    success: false,
                    error: errorData.detail || errorData.error || 'Service d\'enrichissement indisponible',
                    probability_score: 50,
                    ai_summary: 'Enrichissement non disponible',
                },
                { status: response.status }
            );
        }

        const data: DeepEnrichResponse = await response.json();

        return NextResponse.json(data);

    } catch (error) {
        console.error('[DeepEnrich] API error:', error);

        // Return error with fallback data
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Erreur interne',
                probability_score: 50,
                ai_summary: 'Erreur lors de l\'enrichissement',
            },
            { status: 500 }
        );
    }
}
