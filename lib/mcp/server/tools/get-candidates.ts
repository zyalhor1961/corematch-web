/**
 * MCP Tool: get_candidates
 *
 * Liste les candidats d'un projet avec leurs statuts d'analyse.
 */

import { verifyMCPProjectAccess, verifyMCPScope, type MCPAuthUser } from '../../../auth/mcp-auth';
import { supabaseAdmin } from '../../../supabase/admin';
import { isMockMode, getMockCandidates } from './mock-data';

/**
 * Arguments du tool get_candidates
 */
export interface GetCandidatesArgs {
  projectId: string;
  limit?: number; // Défaut: 50
  offset?: number; // Défaut: 0
  status?: 'all' | 'analyzed' | 'pending'; // Défaut: 'all'
}

/**
 * Résultat du tool get_candidates
 */
export interface GetCandidatesResult {
  candidates: Array<{
    id: string;
    name: string;
    email?: string;
    status: 'analyzed' | 'pending';
    score?: number;
    recommendation?: string;
    analyzed_at?: string;
    consent_mcp: boolean;
  }>;
  total: number;
  has_more: boolean;
}

/**
 * Tool get_candidates - Lister les candidats d'un projet
 *
 * @param args - Arguments (projectId, limit, offset, status)
 * @param authUser - Utilisateur authentifié
 * @returns Liste de candidats
 *
 * @example
 * const result = await getCandidates({
 *   projectId: 'project-123',
 *   limit: 10,
 *   status: 'analyzed',
 * }, authUser);
 */
export async function getCandidates(
  args: GetCandidatesArgs,
  authUser?: MCPAuthUser
): Promise<GetCandidatesResult> {
  // =========================================================================
  // 1. Validation auth
  // =========================================================================

  if (!authUser) {
    throw new Error('AUTH_REQUIRED: Authentication required');
  }

  if (!verifyMCPScope(authUser, 'cv:read')) {
    throw new Error('PERMISSION_DENIED: Insufficient permissions (cv:read required)');
  }

  // Mode TEST: Bypass access check si test user
  if (authUser.id !== 'test-user-123') {
    console.error(`[get_candidates] Checking access for user ${authUser.id} (type: ${authUser.type}) to project ${args.projectId}`);
    console.error(`[get_candidates] User org_id: ${authUser.org_id}, project_id: ${authUser.project_id}`);

    const hasAccess = await verifyMCPProjectAccess(authUser, args.projectId);

    console.error(`[get_candidates] Access check result: ${hasAccess}`);

    if (!hasAccess) {
      throw new Error('ACCESS_DENIED: You do not have access to this project');
    }
  }

  // =========================================================================
  // 2. Mode MOCK: Retourner données de test
  // =========================================================================

  if (isMockMode()) {
    console.error(`[get_candidates] 🧪 MOCK MODE: Returning test data`);
    const mockData = getMockCandidates(args.projectId);

    // Appliquer filtres et pagination
    let filteredCandidates = mockData.candidates;

    if (args.status === 'analyzed') {
      filteredCandidates = filteredCandidates.filter((c) => c.status === 'analyzed');
    } else if (args.status === 'pending') {
      filteredCandidates = filteredCandidates.filter((c) => c.status === 'pending');
    }

    const limit = args.limit || 50;
    const offset = args.offset || 0;
    const paginatedCandidates = filteredCandidates.slice(offset, offset + limit);

    return {
      candidates: paginatedCandidates,
      total: filteredCandidates.length,
      has_more: offset + limit < filteredCandidates.length,
    };
  }

  // =========================================================================
  // 3. Query DB (mode production)
  // =========================================================================

  const limit = args.limit || 50;
  const offset = args.offset || 0;

  console.error(`[get_candidates] Fetching candidates for project ${args.projectId}`);

  // Query candidates avec leurs résultats d'analyse
  let query = supabaseAdmin
    .from('candidates')
    .select(
      `
      id,
      first_name,
      last_name,
      email,
      consent_mcp,
      score,
      evaluation_result,
      status,
      created_at
    `
    )
    .eq('project_id', args.projectId)
    .order('created_at', { ascending: false });

  // Filtre par statut
  if (args.status === 'analyzed') {
    query = query.eq('status', 'analyzed');
  } else if (args.status === 'pending') {
    query = query.in('status', ['pending', 'processing']);
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data: candidates, error, count } = await query;

  if (error) {
    console.error('[get_candidates] Database error:', error);
    throw new Error(`DATABASE_ERROR: ${error.message}`);
  }

  if (!candidates) {
    return {
      candidates: [],
      total: 0,
      has_more: false,
    };
  }

  // =========================================================================
  // 3. Formater résultat
  // =========================================================================

  const formattedCandidates = candidates.map((candidate: any) => {
    // Extraire le score et la recommandation depuis evaluation_result (nouveau format) ou score (ancien format)
    const evaluationResult = candidate.evaluation_result;
    const overallScore =
      evaluationResult?.overall_score_0_to_100 ?? candidate.score ?? undefined;
    const recommendation =
      evaluationResult?.recommendation ?? candidate.explanation ?? undefined;

    return {
      id: candidate.id,
      name: `${candidate.first_name} ${candidate.last_name}`,
      email: candidate.email,
      status: candidate.status === 'analyzed' ? 'analyzed' : 'pending',
      score: overallScore,
      recommendation: recommendation,
      analyzed_at: candidate.status === 'analyzed' ? candidate.created_at : undefined,
      consent_mcp: candidate.consent_mcp || false,
    };
  });

  console.error(`[get_candidates] Found ${formattedCandidates.length} candidates`);

  return {
    candidates: formattedCandidates as any,
    total: count || formattedCandidates.length,
    has_more: (count || 0) > offset + limit,
  };
}
