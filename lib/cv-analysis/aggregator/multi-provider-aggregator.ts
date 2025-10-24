/**
 * Multi-Provider Aggregator
 *
 * Agrège les résultats de plusieurs providers (OpenAI, Gemini, Claude)
 * pour produire un verdict final robuste avec consensus.
 */

import type {
  EvaluationResult,
  ProviderResult,
  ProviderName,
  AggregatedResult,
  ConsensusLevel,
  ConsensusMetrics,
  ArbiterOutput,
} from '../types';
import { PROVIDER_CONFIGS, CONSENSUS_THRESHOLDS } from '../config';

/**
 * Options d'agrégation
 */
export interface AggregatorOptions {
  useWeights?: boolean; // Utiliser les poids des providers (défaut: true)
  requireArbiter?: boolean; // Forcer l'arbitre même si consensus fort
  minimumProviders?: number; // Minimum de providers requis (défaut: 2)
}

/**
 * Résultat d'agrégation
 */
export interface AggregationResult {
  final_decision: EvaluationResult;
  consensus: ConsensusMetrics;
  arbiter?: ArbiterOutput;
  disagreements: string[];
}

/**
 * Agréger les résultats de plusieurs providers
 */
export function aggregateProviderResults(
  providersResults: Record<ProviderName, EvaluationResult | null>,
  options: AggregatorOptions = {}
): AggregationResult {
  const {
    useWeights = true,
    requireArbiter = false,
    minimumProviders = 2,
  } = options;

  console.log('\n🔄 AGGREGATOR: Starting multi-provider aggregation');

  // =========================================================================
  // 1. Filtrer les résultats valides
  // =========================================================================

  const validResults = Object.entries(providersResults)
    .filter(([_, result]) => result !== null)
    .map(([provider, result]) => ({
      provider: provider as ProviderName,
      result: result!,
    }));

  console.log(`   Valid providers: ${validResults.length}/${Object.keys(providersResults).length}`);

  if (validResults.length < minimumProviders) {
    throw new Error(
      `[Aggregator] Insufficient valid results: ${validResults.length} < ${minimumProviders}`
    );
  }

  // =========================================================================
  // 2. Calculer les métriques de consensus
  // =========================================================================

  const consensus = calculateConsensusMetrics(validResults, useWeights);

  console.log(`   Consensus level: ${consensus.level}`);
  console.log(`   Agreement rate: ${(consensus.agreement_rate * 100).toFixed(0)}%`);
  console.log(`   Disagreements: ${consensus.disagreements_count}`);

  // =========================================================================
  // 3. Identifier les désaccords
  // =========================================================================

  const disagreements = identifyDisagreements(validResults, consensus);

  if (disagreements.length > 0) {
    console.log(`   ⚠️  Disagreements detected:`);
    disagreements.forEach((d) => console.log(`      - ${d}`));
  }

  // =========================================================================
  // 4. Décider si arbitre nécessaire
  // =========================================================================

  const needsArbiter =
    requireArbiter ||
    consensus.level === 'weak' ||
    (consensus.level === 'moderate' && consensus.disagreements_count > 2);

  console.log(`   Arbiter needed: ${needsArbiter}`);

  // =========================================================================
  // 5. Produire le verdict final
  // =========================================================================

  let finalDecision: EvaluationResult;
  let arbiterOutput: ArbiterOutput | undefined;

  if (needsArbiter) {
    // L'arbitre sera appelé par l'orchestrator
    // Pour l'instant, on fait une agrégation simple
    console.log(`   📊 Using weighted aggregation (arbiter will be called later)`);
    finalDecision = aggregateWithWeights(validResults, useWeights);
  } else {
    // Consensus fort ou modéré : agrégation directe
    console.log(`   📊 Using weighted aggregation (no arbiter needed)`);
    finalDecision = aggregateWithWeights(validResults, useWeights);
  }

  console.log('✅ AGGREGATOR: Aggregation completed\n');

  return {
    final_decision: finalDecision,
    consensus,
    arbiter: arbiterOutput,
    disagreements,
  };
}

/**
 * Calculer les métriques de consensus
 */
function calculateConsensusMetrics(
  results: Array<{ provider: ProviderName; result: EvaluationResult }>,
  useWeights: boolean
): ConsensusMetrics {
  const scores = results.map((r) => r.result.overall_score_0_to_100);
  const recommendations = results.map((r) => r.result.recommendation);

  // =========================================================================
  // Calcul de la moyenne et écart-type des scores
  // =========================================================================

  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance =
    scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Delta max entre scores
  const deltaOverallScore = Math.max(...scores) - Math.min(...scores);

  // =========================================================================
  // Deltas entre sous-scores
  // =========================================================================

  const expScores = results.map((r) => r.result.subscores.experience_years_relevant);
  const skillsScores = results.map((r) => r.result.subscores.skills_match_0_to_100);
  const niceScores = results.map((r) => r.result.subscores.nice_to_have_0_to_100);

  const deltaSubscores = {
    experience: Math.max(...expScores) - Math.min(...expScores),
    skills: Math.max(...skillsScores) - Math.min(...skillsScores),
    nice_to_have: Math.max(...niceScores) - Math.min(...niceScores),
  };

  // =========================================================================
  // Taux d'accord sur la recommandation
  // =========================================================================

  const recommendationCounts = recommendations.reduce((acc, rec) => {
    acc[rec] = (acc[rec] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostCommonRec = Object.keys(recommendationCounts).reduce((a, b) =>
    recommendationCounts[a] > recommendationCounts[b] ? a : b
  );

  const agreementRate = recommendationCounts[mostCommonRec] / recommendations.length;

  // =========================================================================
  // Nombre de désaccords
  // =========================================================================

  let disagreementsCount = 0;

  // Désaccord sur recommandation
  if (agreementRate < 1.0) {
    disagreementsCount += 1;
  }

  // Désaccord sur score (delta > 15)
  if (deltaOverallScore > 15) {
    disagreementsCount += 1;
  }

  // Désaccord sur must-have
  const mustHaveResults = results.map((r) => r.result.meets_all_must_have);
  if (new Set(mustHaveResults).size > 1) {
    disagreementsCount += 1;
  }

  // =========================================================================
  // Déterminer le niveau de consensus
  // =========================================================================

  let consensusLevel: ConsensusLevel;

  if (
    agreementRate >= CONSENSUS_THRESHOLDS.strong_agreement_rate &&
    deltaOverallScore <= CONSENSUS_THRESHOLDS.max_score_delta_strong
  ) {
    consensusLevel = 'strong';
  } else if (
    agreementRate >= CONSENSUS_THRESHOLDS.moderate_agreement_rate &&
    deltaOverallScore <= CONSENSUS_THRESHOLDS.max_score_delta_moderate
  ) {
    consensusLevel = 'moderate';
  } else {
    consensusLevel = 'weak';
  }

  return {
    level: consensusLevel,
    delta_overall_score: deltaOverallScore,
    delta_subscores: deltaSubscores,
    agreement_rate: agreementRate,
    disagreements_count: disagreementsCount,
  };
}

/**
 * Identifier les désaccords entre providers
 */
function identifyDisagreements(
  results: Array<{ provider: ProviderName; result: EvaluationResult }>,
  consensus: ConsensusMetrics
): string[] {
  const disagreements: string[] = [];

  // =========================================================================
  // Désaccord sur recommandation
  // =========================================================================

  const recommendations = results.map((r) => ({
    provider: r.provider,
    rec: r.result.recommendation,
  }));

  const uniqueRecs = new Set(recommendations.map((r) => r.rec));
  if (uniqueRecs.size > 1) {
    const recStr = recommendations.map((r) => `${r.provider}=${r.rec}`).join(', ');
    disagreements.push(`Recommendation: ${recStr}`);
  }

  // =========================================================================
  // Désaccord sur score (> 15 pts)
  // =========================================================================

  if (consensus.delta_overall_score > 15) {
    const scores = results.map((r) => ({
      provider: r.provider,
      score: r.result.overall_score_0_to_100.toFixed(1),
    }));
    const scoreStr = scores.map((s) => `${s.provider}=${s.score}`).join(', ');
    disagreements.push(`Overall score: ${scoreStr} (Δ=${consensus.delta_overall_score.toFixed(1)})`);
  }

  // =========================================================================
  // Désaccord sur must-have
  // =========================================================================

  const mustHaveResults = results.map((r) => ({
    provider: r.provider,
    meets: r.result.meets_all_must_have,
  }));

  if (new Set(mustHaveResults.map((r) => r.meets)).size > 1) {
    const mustStr = mustHaveResults.map((m) => `${m.provider}=${m.meets ? 'OK' : 'FAIL'}`).join(', ');
    disagreements.push(`Must-have: ${mustStr}`);
  }

  // =========================================================================
  // Désaccord sur sous-scores (> 20 pts)
  // =========================================================================

  if (consensus.delta_subscores.skills > 20) {
    disagreements.push(`Skills match: Δ=${consensus.delta_subscores.skills.toFixed(1)} pts`);
  }

  return disagreements;
}

/**
 * Agréger avec pondération par provider
 */
function aggregateWithWeights(
  results: Array<{ provider: ProviderName; result: EvaluationResult }>,
  useWeights: boolean
): EvaluationResult {
  // =========================================================================
  // 1. Calculer les poids
  // =========================================================================

  const weights = results.map((r) => ({
    provider: r.provider,
    weight: useWeights ? PROVIDER_CONFIGS[r.provider].weight : 1.0 / results.length,
  }));

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

  // Normaliser les poids pour que la somme = 1
  const normalizedWeights = weights.map((w) => ({
    provider: w.provider,
    weight: w.weight / totalWeight,
  }));

  console.log(
    `   Weights: ${normalizedWeights.map((w) => `${w.provider}=${(w.weight * 100).toFixed(0)}%`).join(', ')}`
  );

  // =========================================================================
  // 2. Calculer le score global pondéré
  // =========================================================================

  const weightedScore = results.reduce((sum, r) => {
    const weight = normalizedWeights.find((w) => w.provider === r.provider)!.weight;
    return sum + r.result.overall_score_0_to_100 * weight;
  }, 0);

  // =========================================================================
  // 3. Calculer les sous-scores pondérés
  // =========================================================================

  const weightedExp = results.reduce((sum, r) => {
    const weight = normalizedWeights.find((w) => w.provider === r.provider)!.weight;
    return sum + r.result.subscores.experience_years_relevant * weight;
  }, 0);

  const weightedSkills = Math.round(
    results.reduce((sum, r) => {
      const weight = normalizedWeights.find((w) => w.provider === r.provider)!.weight;
      return sum + r.result.subscores.skills_match_0_to_100 * weight;
    }, 0)
  );

  const weightedNice = Math.round(
    results.reduce((sum, r) => {
      const weight = normalizedWeights.find((w) => w.provider === r.provider)!.weight;
      return sum + r.result.subscores.nice_to_have_0_to_100 * weight;
    }, 0)
  );

  // =========================================================================
  // 4. Déterminer la recommandation finale (vote majoritaire)
  // =========================================================================

  const recommendationCounts = results.reduce((acc, r) => {
    acc[r.result.recommendation] = (acc[r.result.recommendation] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const finalRecommendation = Object.keys(recommendationCounts).reduce((a, b) =>
    recommendationCounts[a] > recommendationCounts[b] ? a : b
  ) as 'SHORTLIST' | 'CONSIDER' | 'REJECT';

  // =========================================================================
  // 5. Agréger les must-have (union des échecs)
  // =========================================================================

  const allFails = results.flatMap((r) => r.result.fails);
  const uniqueFails = Array.from(
    new Map(allFails.map((f) => [f.rule_id, f])).values()
  );

  const meetsAllMustHave = uniqueFails.length === 0;

  // =========================================================================
  // 6. Agréger les forces (union avec compteur)
  // =========================================================================

  const allStrengths = results.flatMap((r) => r.result.strengths);
  const strengthCounts = allStrengths.reduce((acc, s) => {
    const key = `${s.category}:${s.point}`;
    if (!acc[key]) {
      acc[key] = { strength: s, count: 0 };
    }
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { strength: any; count: number }>);

  // Garder uniquement les forces mentionnées par au moins 2 providers
  const agreedStrengths = Object.values(strengthCounts)
    .filter((s) => s.count >= Math.min(2, results.length))
    .map((s) => s.strength)
    .slice(0, 5); // Top 5

  // =========================================================================
  // 7. Agréger les améliorations
  // =========================================================================

  const allImprovements = results.flatMap((r) => r.result.improvements);
  const improvementCounts = allImprovements.reduce((acc, imp) => {
    const key = `${imp.point}`;
    if (!acc[key]) {
      acc[key] = { improvement: imp, count: 0 };
    }
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { improvement: any; count: number }>);

  const agreedImprovements = Object.values(improvementCounts)
    .filter((i) => i.count >= Math.min(2, results.length))
    .map((i) => i.improvement)
    .slice(0, 3); // Top 3

  // =========================================================================
  // 8. Agréger relevance_summary (prendre le provider avec le plus d'expériences DIRECTE)
  // =========================================================================

  const bestRelevanceSummary = results.reduce((best, current) => {
    const currentDirect = current.result.relevance_summary.months_direct;
    const bestDirect = best.result.relevance_summary.months_direct;
    return currentDirect > bestDirect ? current : best;
  }).result.relevance_summary;

  // =========================================================================
  // 9. Construire le résultat final
  // =========================================================================

  const finalDecision: EvaluationResult = {
    meets_all_must_have: meetsAllMustHave,
    fails: uniqueFails,
    relevance_summary: bestRelevanceSummary,
    subscores: {
      experience_years_relevant: weightedExp,
      skills_match_0_to_100: weightedSkills,
      nice_to_have_0_to_100: weightedNice,
    },
    overall_score_0_to_100: weightedScore,
    recommendation: finalRecommendation,
    strengths: agreedStrengths,
    improvements: agreedImprovements,
  };

  return finalDecision;
}
