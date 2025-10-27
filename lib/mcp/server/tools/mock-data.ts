/**
 * Mock Data pour tests MCP sans DB
 */

import type { GetCandidatesResult } from './get-candidates';
import type { AnalyzeCVResult } from './analyze-cv';

/**
 * Mock data: Liste de candidats
 */
export function getMockCandidates(projectId: string): GetCandidatesResult {
  return {
    candidates: [
      {
        id: 'candidate-001',
        name: 'Marie Dupont',
        email: 'marie.dupont@example.com',
        status: 'analyzed',
        score: 87.5,
        recommendation: 'YES',
        analyzed_at: '2025-01-26T10:30:00Z',
        consent_mcp: true,
      },
      {
        id: 'candidate-002',
        name: 'Jean Martin',
        email: 'jean.martin@example.com',
        status: 'analyzed',
        score: 72.3,
        recommendation: 'MAYBE',
        analyzed_at: '2025-01-26T09:15:00Z',
        consent_mcp: true,
      },
      {
        id: 'candidate-003',
        name: 'Sophie Bernard',
        email: 'sophie.bernard@example.com',
        status: 'pending',
        consent_mcp: false,
      },
    ],
    total: 3,
    has_more: false,
  };
}

/**
 * Mock data: Résultat d'analyse CV
 */
export function getMockAnalysisResult(
  candidateId: string,
  projectId: string,
  mode: string
): AnalyzeCVResult {
  // Scores différents selon le mode
  const scoresByMode = {
    eco: 75.0,
    balanced: 82.5,
    premium: 87.3,
  };

  const costsByMode = {
    eco: 0.015,
    balanced: 0.042,
    premium: 0.068,
  };

  const durationByMode = {
    eco: 3500,
    balanced: 8200,
    premium: 15600,
  };

  const providersUsedByMode = {
    eco: ['openai'],
    balanced: ['openai', 'gemini'],
    premium: ['openai', 'gemini', 'claude'],
  };

  return {
    recommendation: 'YES',
    score: scoresByMode[mode as keyof typeof scoresByMode] || 80.0,
    strengths: [
      'React (5 ans)',
      'TypeScript (3 ans)',
      'Node.js (4 ans)',
      'Architecture microservices',
      'Tests unitaires',
    ],
    weaknesses: ['AWS (seulement 1 an)', 'Docker (débutant)', 'Kubernetes (non mentionné)'],
    cost_usd: costsByMode[mode as keyof typeof costsByMode] || 0.04,
    duration_ms: durationByMode[mode as keyof typeof durationByMode] || 8000,
    from_cache: false,
    context_snapshot: {
      engine: 'corematch-mcp',
      providers_used: providersUsedByMode[mode as keyof typeof providersUsedByMode] || [
        'openai',
        'gemini',
      ],
      consensus_level: mode === 'premium' ? 'strong' : mode === 'balanced' ? 'medium' : 'strong',
      pii_masking_level: 'partial',
    },
  };
}

/**
 * Vérifier si on est en mode mock (env var de test)
 */
export function isMockMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://test.supabase.co' ||
    process.env.MCP_MOCK_MODE === 'true'
  );
}
