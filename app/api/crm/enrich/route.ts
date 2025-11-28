import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface EnrichmentResult {
  company_name: string;
  website: string;
  logo_url?: string;
  description?: string;
  sector?: string;
  headquarters?: string;
  employee_count?: string;
  ai_summary?: string;
  ai_score?: number;
  ai_next_action?: string;
  suggested_contact?: {
    name?: string;
    role?: string;
    email_pattern?: string;
  };
  // Smart Growth Engine fields
  relationship_type: 'prospect' | 'competitor' | 'partner' | 'unknown';
  relationship_reasoning?: string;
  buying_signals?: string[];
  pain_points?: string[];
}

/**
 * Smart Growth Engine API - Enrichment Agent
 *
 * Flow:
 * 1. Try Python Enrichment Agent first (Firecrawl + OpenAI = real website data)
 * 2. Fall back to direct OpenAI if Python service unavailable
 *
 * The key insight: The user is the SELLER, not the buyer.
 * If user sells "renovation batiment", we should NOT find renovation companies.
 * We should find CLIENTS who need renovation (hotels, real estate, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const { domain, myBusiness, targetDescription } = await request.json();

    if (!domain && !targetDescription) {
      return NextResponse.json(
        { error: 'domain or targetDescription is required' },
        { status: 400 }
      );
    }

    // Mode 1: Analyze a specific domain with competitor detection
    if (domain) {
      // Try Python Enrichment Agent first (Firecrawl scraping)
      try {
        const pythonResult = await analyzeDomainWithPython(domain, myBusiness);
        if (pythonResult) {
          console.log('[Enrich] Used Python Enrichment Agent (Firecrawl)');
          return pythonResult;
        }
      } catch (pythonError) {
        console.warn('[Enrich] Python service unavailable, falling back to OpenAI:', pythonError);
      }

      // Fallback: Use direct OpenAI (knowledge-based)
      console.log('[Enrich] Using OpenAI fallback (no scraping)');
      return await analyzeDomainWithOpenAI(domain, myBusiness);
    }

    // Mode 2: Generate target prospects based on description (future feature)
    return NextResponse.json(
      { error: 'Target-based search not yet implemented' },
      { status: 501 }
    );
  } catch (error: any) {
    console.error('Enrichment error:', error);
    return NextResponse.json(
      { error: error.message || 'Enrichment failed' },
      { status: 500 }
    );
  }
}

/**
 * Try to use Python Enrichment Agent (Firecrawl + OpenAI)
 * Returns null if Python service is unavailable
 */
async function analyzeDomainWithPython(domain: string, myBusiness?: string): Promise<NextResponse | null> {
  const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
  const url = domain.startsWith('http') ? domain : `https://${domain}`;

  const response = await fetch(`${pythonServiceUrl}/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      my_business: myBusiness || null,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  // Clean domain for logo
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase();

  // Transform Python response to frontend format
  const result: EnrichmentResult = {
    company_name: data.company_name || cleanDomain,
    website: url,
    logo_url: data.logo_url || `https://logo.clearbit.com/${cleanDomain}`,
    description: data.short_description || data.description,
    sector: data.sector,
    headquarters: data.headquarters,
    employee_count: data.employee_count,
    ai_summary: data.ai_summary,
    ai_score: data.ai_score ?? 50,
    ai_next_action: data.ai_next_action,
    suggested_contact: data.suggested_contact,
    relationship_type: data.relationship_type || 'unknown',
    relationship_reasoning: data.relationship_reasoning,
    buying_signals: data.buying_signals || [],
    pain_points: data.pain_points || [],
  };

  return NextResponse.json(result);
}

/**
 * Fallback: Use direct OpenAI for enrichment (knowledge-based, no scraping)
 */
async function analyzeDomainWithOpenAI(domain: string, myBusiness?: string): Promise<NextResponse> {
  // Clean domain
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase();

  // Build the context for smart analysis
  const businessContext = myBusiness
    ? `
CONTEXTE IMPORTANT - L'UTILISATEUR EST VENDEUR:
L'utilisateur dirige une entreprise qui fait: "${myBusiness}"
Tu dois déterminer si "${cleanDomain}" est un CLIENT POTENTIEL ou un CONCURRENT.

RÈGLE D'OR:
- Si l'entreprise analysée fait la MÊME chose que l'utilisateur → c'est un CONCURRENT
- Si l'entreprise analysée pourrait ACHETER les services de l'utilisateur → c'est un PROSPECT
- Si l'entreprise est complémentaire (peut référer des clients) → c'est un PARTENAIRE

Exemple: Si l'utilisateur vend "rénovation bâtiment":
- Une autre entreprise de rénovation = CONCURRENT ⚠️
- Un hôtel, une foncière, un syndic = PROSPECT ✅
- Un architecte, un bureau d'études = PARTENAIRE 🤝
`
    : '';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Tu es un Directeur Commercial senior avec 20 ans d'expérience en B2B.
Tu analyses les entreprises pour qualifier des leads commerciaux.
Tu raisonnes de manière stratégique, pas comme un moteur de recherche basique.
${businessContext}
Réponds UNIQUEMENT en JSON valide, sans markdown ni commentaires.`
      },
      {
        role: 'user',
        content: `Analyse le domaine "${cleanDomain}" et fournis les informations suivantes en JSON:

{
  "company_name": "Nom officiel de l'entreprise",
  "description": "Description courte de l'activité (1-2 phrases)",
  "sector": "Secteur d'activité",
  "headquarters": "Ville, Pays du siège",
  "employee_count": "Estimation (ex: '50-200', '1000+')",

  "relationship_type": "prospect" | "competitor" | "partner" | "unknown",
  "relationship_reasoning": "Explication de pourquoi c'est un prospect/concurrent/partenaire (1 phrase)",

  "ai_summary": "Résumé stratégique pour un commercial: points forts, opportunités, risques",
  "ai_score": 0-100 (score de pertinence comme CLIENT POTENTIEL, pas comme entreprise générale),
  "ai_next_action": "Prochaine action recommandée",

  "buying_signals": ["Signal d'achat 1", "Signal 2"] (indices que l'entreprise pourrait avoir besoin de nos services),
  "pain_points": ["Point de douleur 1", "Point 2"] (problèmes que l'entreprise pourrait avoir que nous pouvons résoudre),

  "suggested_contact": {
    "name": "Nom probable du décideur (si connu)",
    "role": "Rôle à cibler (CEO, CTO, DAF, DG...)",
    "email_pattern": "Pattern email probable (ex: prenom.nom@domain.com)"
  }
}

IMPORTANT:
- Si c'est un CONCURRENT, le ai_score doit être 0 et ai_next_action doit être "⚠️ Attention: Ceci est un concurrent, pas un prospect"
- Si c'est un PROSPECT, donne un score élevé et des actions concrètes
- buying_signals: Liste ce qui pourrait indiquer un besoin (croissance, levée de fonds, expansion, problèmes connus...)
- pain_points: Liste les problèmes typiques de ce type d'entreprise

Si tu ne connais pas certaines informations, mets null. Sois factuel et stratégique.`
      }
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const responseText = completion.choices[0]?.message?.content || '{}';

  // Parse JSON response
  let enrichedData: Partial<EnrichmentResult>;
  try {
    const cleanJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    enrichedData = JSON.parse(cleanJson);
  } catch {
    console.error('Failed to parse OpenAI response:', responseText);
    enrichedData = {
      company_name: cleanDomain.split('.')[0].charAt(0).toUpperCase() + cleanDomain.split('.')[0].slice(1),
      description: 'Informations non disponibles',
      relationship_type: 'unknown',
    };
  }

  // Get logo from Clearbit (free tier)
  const logoUrl = `https://logo.clearbit.com/${cleanDomain}`;

  const result: EnrichmentResult = {
    company_name: enrichedData.company_name || cleanDomain,
    website: `https://${cleanDomain}`,
    logo_url: logoUrl,
    description: enrichedData.description,
    sector: enrichedData.sector,
    headquarters: enrichedData.headquarters,
    employee_count: enrichedData.employee_count,
    ai_summary: enrichedData.ai_summary,
    ai_score: enrichedData.ai_score,
    ai_next_action: enrichedData.ai_next_action,
    suggested_contact: enrichedData.suggested_contact,
    // Smart Growth Engine fields
    relationship_type: enrichedData.relationship_type || 'unknown',
    relationship_reasoning: enrichedData.relationship_reasoning,
    buying_signals: enrichedData.buying_signals,
    pain_points: enrichedData.pain_points,
  };

  return NextResponse.json(result);
}
