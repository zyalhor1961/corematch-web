/**
 * MCP Tool: analyze_cv
 *
 * Analyser un CV contre un JobSpec via l'orchestrator.
 */

import { verifyMCPProjectAccess, verifyMCPScope, type MCPAuthUser } from '../../../auth/mcp-auth';
import { validateAnalysisRequest } from '../../security/pii-masking';
import { supabaseAdmin } from '../../../supabase/admin';
import { orchestrateAnalysis } from '../../../cv-analysis/orchestrator';
import type { AnalysisMode, JobSpec } from '../../../cv-analysis/types';
import { isMockMode, getMockAnalysisResult } from './mock-data';
import { loadCandidateCV } from '../utils/cv-parser';

/**
 * Arguments du tool analyze_cv
 */
export interface AnalyzeCVArgs {
  candidateId: string;
  projectId: string;
  mode?: AnalysisMode; // Défaut: 'balanced'
  forceReanalysis?: boolean; // Défaut: false (utilise cache si dispo)
}

/**
 * Résultat du tool analyze_cv
 */
export interface AnalyzeCVResult {
  recommendation: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  cost_usd: number;
  duration_ms: number;
  from_cache: boolean;
  context_snapshot: {
    engine: string;
    providers_used: string[];
    consensus_level: string;
    pii_masking_level: string;
  };
}

/**
 * Tool analyze_cv - Analyser un CV contre un JobSpec
 *
 * @param args - Arguments (candidateId, projectId, mode)
 * @param authUser - Utilisateur authentifié
 * @returns Résultat d'analyse
 *
 * @example
 * const result = await analyzeCV({
 *   candidateId: 'candidate-123',
 *   projectId: 'project-456',
 *   mode: 'premium',
 * }, authUser);
 */
export async function analyzeCV(
  args: AnalyzeCVArgs,
  authUser?: MCPAuthUser
): Promise<AnalyzeCVResult> {
  const startTime = Date.now();

  console.error('\n════════════════════════════════════════════════');
  console.error(`🔬 MCP Tool: analyze_cv`);
  console.error(`   Candidate: ${args.candidateId}`);
  console.error(`   Project: ${args.projectId}`);
  console.error(`   Mode: ${args.mode || 'balanced'}`);
  console.error('════════════════════════════════════════════════\n');

  // =========================================================================
  // 1. Mode MOCK: Retourner données de test (bypass ALL checks)
  // =========================================================================

  if (isMockMode()) {
    console.error('\n🧪 MOCK MODE: Returning test analysis data\n');
    console.error('   (ALL auth/access checks bypassed in MOCK mode)\n');

    const mode: AnalysisMode = args.mode || 'balanced';
    const mockResult = getMockAnalysisResult(args.candidateId, args.projectId, mode);

    console.error(`✅ Mock analysis completed`);
    console.error(`   Score: ${mockResult.score}/100`);
    console.error(`   Recommendation: ${mockResult.recommendation}`);
    console.error(`   Cost: $${mockResult.cost_usd.toFixed(4)}`);
    console.error(`   Duration: ${mockResult.duration_ms}ms (simulated)\n`);

    return mockResult;
  }

  // =========================================================================
  // 2. Validation auth (mode production uniquement)
  // =========================================================================

  if (!authUser) {
    throw new Error('AUTH_REQUIRED: Authentication required');
  }

  if (!verifyMCPScope(authUser, 'cv:analyze')) {
    throw new Error('PERMISSION_DENIED: Insufficient permissions (cv:analyze required)');
  }

  // =========================================================================
  // 3. Vérifier accès au projet (mode production uniquement)
  // =========================================================================

  console.error('🔐 Checking project access...');

  // Mode TEST: Bypass access check si test user
  if (authUser.id !== 'test-user-123') {
    console.error(`[analyze_cv] Checking access for user ${authUser.id} (type: ${authUser.type}) to project ${args.projectId}`);
    console.error(`[analyze_cv] User org_id: ${authUser.org_id}, project_id: ${authUser.project_id}`);

    const hasAccess = await verifyMCPProjectAccess(authUser, args.projectId);

    console.error(`[analyze_cv] Access check result: ${hasAccess}`);

    if (!hasAccess) {
      throw new Error('ACCESS_DENIED: You do not have access to this project');
    }
  }

  console.error(`✅ Auth verified: ${authUser.type}:${authUser.id}`);

  // =========================================================================
  // 4. Validation RGPD (mode production)
  // =========================================================================

  console.error('🔒 Checking RGPD compliance...');

  const { consent_granted, pii_masking_level } = await validateAnalysisRequest({
    candidateId: args.candidateId,
    projectId: args.projectId,
    requireConsent: true, // MCP nécessite consent
  });

  console.error(`✅ RGPD: Consent=${consent_granted}, Masking=${pii_masking_level}`);

  // =========================================================================
  // 3. Récupérer données depuis DB
  // =========================================================================

  console.error('📄 Fetching candidate and project data...');

  // Récupérer candidat
  const { data: candidate, error: candidateError } = await supabaseAdmin
    .from('candidates')
    .select('id, first_name, last_name, cv_url, cv_filename')
    .eq('id', args.candidateId)
    .single();

  if (candidateError || !candidate) {
    console.error('[analyze_cv] Candidate query error:', candidateError);
    throw new Error(`CANDIDATE_NOT_FOUND: Candidate ${args.candidateId} not found`);
  }

  if (!candidate.cv_url) {
    throw new Error('CV_MISSING: Candidate has no CV uploaded');
  }

  console.error(`✅ Candidate: ${candidate.first_name} ${candidate.last_name}`);

  // Récupérer projet et JobSpec
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id, name, job_spec_config')
    .eq('id', args.projectId)
    .single();

  if (projectError || !project) {
    console.error('[analyze_cv] Project query error:', projectError);
    throw new Error(`PROJECT_NOT_FOUND: Project ${args.projectId} not found`);
  }

  if (!project.job_spec_config) {
    throw new Error('JOB_SPEC_MISSING: Project has no job specification');
  }

  console.error(`✅ Candidate: ${candidate.first_name} ${candidate.last_name}`);
  console.error(`✅ Project: ${project.name}`);

  // =========================================================================
  // 4. Parser le CV et préparer les données
  // =========================================================================

  console.error('\n📄 Loading and parsing CV...\n');

  // Parser le CV depuis cv_url
  const cvText = await loadCandidateCV({
    cv_url: candidate.cv_url,
    first_name: candidate.first_name,
    last_name: candidate.last_name,
  });

  console.error(`✅ CV loaded: ${cvText.length} characters`);

  // Adapter job_spec_config vers JobSpec
  const jobSpec = project.job_spec_config as JobSpec;

  // =========================================================================
  // 5. Orchestrer analyse
  // =========================================================================

  console.error('\n🎬 Starting analysis orchestration...\n');

  const mode: AnalysisMode = args.mode || 'balanced';

  const result = await orchestrateAnalysis(cvText, jobSpec, {
    mode,
    projectId: args.projectId,
    candidateId: args.candidateId, // ✅ Pour consent/masking DB
    engine: 'corematch-mcp', // ✅ Engine MCP
  });

  const fromCache = result.context_snapshot.duration_total_ms < 1000; // Heuristique

  console.error('\n✅ Analysis completed');
  console.error(`   Score: ${result.final_decision.overall_score_0_to_100.toFixed(1)}/100`);
  console.error(`   Recommendation: ${result.final_decision.recommendation}`);
  console.error(`   Cost: $${result.cost.total_usd.toFixed(4)}`);
  console.error(`   Duration: ${result.performance.total_execution_time_ms}ms`);
  console.error(`   From cache: ${fromCache}`);

  // =========================================================================
  // 5. Sauvegarder résultat dans DB
  // =========================================================================

  console.error('\n💾 Saving analysis result...');

  // Mettre à jour le candidat avec les résultats d'analyse
  const { error: updateError } = await supabaseAdmin
    .from('candidates')
    .update({
      status: 'analyzed',
      score: Math.round(result.final_decision.overall_score_0_to_100), // Ancien format (INTEGER)
      explanation: result.final_decision.recommendation, // Ancien format (TEXT)
      evaluation_result: result.final_decision, // Nouveau format (JSONB complet)
      relevance_months_direct: result.final_decision.relevance_summary?.months_direct ?? 0,
      relevance_months_adjacent: result.final_decision.relevance_summary?.months_adjacent ?? 0,
    })
    .eq('id', args.candidateId);

  if (updateError) {
    console.error('[analyze_cv] Failed to save analysis:', updateError);
    // Ne pas throw - l'analyse a réussi, juste la sauvegarde a échoué
  } else {
    console.error('✅ Analysis saved to database');
  }

  // =========================================================================
  // 6. Formater résultat pour MCP
  // =========================================================================

  const totalTime = Date.now() - startTime;

  console.error(`\n🎉 Total time: ${totalTime}ms\n`);

  return {
    recommendation: result.final_decision.recommendation,
    score: result.final_decision.overall_score_0_to_100,
    strengths: result.final_decision.strengths.map((s) => s.skill),
    weaknesses: result.final_decision.fails.map((f) => f.skill),
    cost_usd: result.cost.total_usd,
    duration_ms: result.performance.total_execution_time_ms,
    from_cache: fromCache,
    context_snapshot: {
      engine: result.context_snapshot.engine,
      providers_used: result.context_snapshot.providers_called.map((p) => p.name),
      consensus_level: result.context_snapshot.consensus_level,
      pii_masking_level: result.context_snapshot.pii_masking_level,
    },
  };
}
