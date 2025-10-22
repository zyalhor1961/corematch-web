import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify-auth';
import { analyzeCV } from '@/lib/cv-analysis/multi-provider-analyzer';
import type { JobSpec } from '@/lib/cv-analysis/deterministic-evaluator';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { cvText, jobSpec } = body as { cvText: string; jobSpec: JobSpec };

    if (!cvText || !jobSpec) {
      return NextResponse.json(
        { error: 'cvText and jobSpec are required' },
        { status: 400 }
      );
    }

    console.log('[API] Starting multi-provider analysis');
    console.log(`[API] User: ${user.email}`);
    console.log(`[API] Job: ${jobSpec.title}`);
    console.log(`[API] CV length: ${cvText.length} characters`);

    // Analyse avec les deux providers
    const result = await analyzeCV(cvText, jobSpec);

    console.log('[API] ✅ Analysis completed successfully');

    return NextResponse.json({
      success: true,
      data: {
        // Résultat agrégé final
        evaluation: result.result,

        // Traçabilité: résultats bruts de chaque provider
        providers_raw: result.providers_raw,

        // Debug: désaccords entre modèles
        debug: result.debug
      },
      metadata: {
        analyzed_by: user.email,
        timestamp: new Date().toISOString(),
        providers_used: result.debug.providers_used,
        disagreements_count: result.debug.model_disagreements.length
      }
    });

  } catch (error) {
    console.error('[API] Multi-provider analysis error:', error);

    return NextResponse.json(
      {
        error: 'Analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Documentation de l'endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/cv/analyze-multi-provider',
    description: 'Analyse de CV multi-provider (OpenAI + Gemini) avec agrégation et traçabilité',
    method: 'POST',
    authentication: 'Bearer token required',
    request_body: {
      cvText: {
        type: 'string',
        description: 'Texte complet du CV à analyser',
        required: true
      },
      jobSpec: {
        type: 'JobSpec',
        description: 'Spécification du poste avec must_have, skills_required, etc.',
        required: true,
        example: {
          title: 'Développeur Full Stack',
          must_have: [
            {
              id: 'M1',
              desc: 'Minimum 3 ans d\'expérience en développement web',
              severity: 'standard'
            }
          ],
          skills_required: ['JavaScript', 'React', 'Node.js'],
          nice_to_have: ['TypeScript', 'Docker'],
          relevance_rules: {
            direct: ['développeur', 'programmer', 'software engineer'],
            adjacent: ['analyste', 'chef de projet technique'],
            peripheral: ['IT', 'informatique']
          },
          weights: {
            w_exp: 0.5,
            w_skills: 0.3,
            w_nice: 0.2,
            p_adjacent: 0.5
          },
          thresholds: {
            years_full_score: 3,
            shortlist_min: 75,
            consider_min: 60
          }
        }
      }
    },
    response: {
      success: true,
      data: {
        evaluation: {
          description: 'Résultat agrégé final (moyenne pondérée OpenAI 55%, Gemini 45%)',
          fields: [
            'meets_all_must_have',
            'fails',
            'relevance_summary',
            'subscores',
            'overall_score_0_to_100',
            'recommendation',
            'strengths',
            'improvements',
            'evidence_global'
          ]
        },
        providers_raw: {
          description: 'Résultats bruts de chaque provider pour traçabilité',
          openai: 'Résultat OpenAI gpt-4o (si succès)',
          gemini: 'Résultat Gemini gemini-1.5-pro (si succès)'
        },
        debug: {
          description: 'Informations de debug et désaccords',
          model_disagreements: 'Liste des champs où les modèles divergent',
          providers_used: 'Providers utilisés (openai, gemini, ou les deux)',
          aggregation_method: 'Méthode d\'agrégation (weighted_average, fallback_openai, fallback_gemini)'
        }
      },
      metadata: {
        analyzed_by: 'Email de l\'utilisateur',
        timestamp: 'ISO 8601 timestamp',
        providers_used: 'Array des providers utilisés',
        disagreements_count: 'Nombre de désaccords entre modèles'
      }
    },
    features: [
      '✅ Pass 1: Extraction avec OpenAI gpt-4o-mini (temperature=0)',
      '✅ Pass 2: Analyse parallèle avec OpenAI gpt-4o + Gemini gemini-1.5-pro',
      '✅ Validation JSON stricte avec AJV',
      '✅ Agrégation: moyenne pondérée, vote majoritaire, union des fails',
      '✅ Fallback: si un provider échoue, utilise l\'autre',
      '✅ Traçabilité: résultats bruts de chaque provider conservés',
      '✅ Debug: liste des désaccords entre modèles',
      '✅ Preuves: tous les evidence avec quote + field_path',
      '✅ Générique: fonctionne pour tous les métiers'
    ]
  });
}
