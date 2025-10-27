/**
 * Context Snapshot Types
 *
 * OBJECTIF: Traçabilité complète de chaque analyse CV
 *
 * Chaque résultat d'analyse inclut un "context snapshot" qui capture:
 * - Engine version et mode
 * - Context du job (projectId, jobSpecHash)
 * - Providers appelés avec détails (coût, durée)
 * - Consensus et arbitrage
 * - Compliance RGPD (PII masking, consent)
 *
 * Usage:
 * - Debugging: Reproduire exactement une analyse
 * - Audit: Tracer qui a accédé à quelles données
 * - UI: Afficher badges de confiance et coût
 * - Monitoring: Analyser performance et coûts
 */

import type { AnalysisMode, ConsensusLevel, ProviderName } from '@/lib/cv-analysis/types';

/**
 * Détails d'un appel à un provider
 */
export interface ProviderCallDetails {
  name: ProviderName;
  model: string; // ex: "gpt-4o", "gemini-2.0-flash-exp"
  called_at: string; // ISO timestamp
  duration_ms: number;
  cost_usd: number;
  status: 'success' | 'failed' | 'timeout';
  error?: string;
}

/**
 * Niveau de masking PII appliqué
 */
export type PIIMaskingLevel = 'none' | 'partial' | 'full';

/**
 * Context Snapshot - Métadonnées complètes d'une analyse
 */
export interface ContextSnapshot {
  // =========================================================================
  // Engine Info
  // =========================================================================

  /** Engine utilisé: 'corematch-v2' (orchestrator classique), 'corematch-mcp' (via MCP), ou 'corematch-cli' (CLI tools) */
  engine: 'corematch-v2' | 'corematch-mcp' | 'corematch-cli';

  /** Version de l'engine, ex: "2.1.0" */
  engine_version: string;

  // =========================================================================
  // Session & Request IDs
  // =========================================================================

  /** ID de session MCP (si via MCP), ou généré pour traçabilité */
  sessionId: string;

  /** ID unique de cette requête d'analyse */
  requestId: string;

  // =========================================================================
  // Job Context
  // =========================================================================

  /** ID du projet de recrutement */
  projectId: string;

  /** Titre du poste */
  job_title: string;

  /** Hash du JobSpec (pour détection de modifications) */
  jobSpecHash: string;

  // =========================================================================
  // Execution Details
  // =========================================================================

  /** Providers appelés avec leurs détails */
  providers_called: ProviderCallDetails[];

  /** Mode d'analyse utilisé */
  mode: AnalysisMode;

  /** Prefilter Stage 0 activé ? */
  prefilter_enabled: boolean;

  /** Context packing activé ? */
  packing_enabled: boolean;

  // =========================================================================
  // Aggregation & Consensus
  // =========================================================================

  /** Niveau de consensus entre providers */
  consensus_level: ConsensusLevel;

  /** Arbitre OpenAI utilisé ? */
  arbiter_used: boolean;

  /** Raison de l'arbitrage (si arbiter_used=true) */
  arbiter_reason?: string;

  /** Désaccords entre providers */
  disagreements: string[];

  // =========================================================================
  // Cost & Performance
  // =========================================================================

  /** Coût total en USD */
  cost_total_usd: number;

  /** Devise (toujours USD) */
  cost_currency: 'USD';

  /** Durée totale d'exécution en ms */
  duration_total_ms: number;

  /** Durée de l'extraction CV en ms */
  duration_extraction_ms: number;

  /** Durée de l'évaluation en ms */
  duration_evaluation_ms: number;

  // =========================================================================
  // Timing
  // =========================================================================

  /** Date/heure de début d'analyse (ISO 8601) */
  analysis_started_at: string;

  /** Date/heure de fin d'analyse (ISO 8601) */
  analysis_completed_at: string;

  // =========================================================================
  // Compliance & Security
  // =========================================================================

  /** Niveau de masking PII appliqué */
  pii_masking_level: PIIMaskingLevel;

  /** Consent MCP vérifié ? */
  consent_mcp_checked: boolean;

  /** Consent accordé ? (si checked=true) */
  consent_mcp_granted?: boolean;

  // =========================================================================
  // Smart Triggering (optionnel)
  // =========================================================================

  /** Raison du smart trigger (si applicable) */
  smart_trigger_reason?: string;

  /** Providers skippés pour économie (si applicable) */
  providers_skipped?: ProviderName[];

  // =========================================================================
  // Evidence Quality (optionnel)
  // =========================================================================

  /** Somme des scores de qualité des évidences (0-2 par évidence) */
  evidence_quality_sum?: number;

  /** Seuil minimum requis */
  evidence_min_required?: number;

  /** Qualité des évidences suffisante ? */
  evidence_meets_threshold?: boolean;
}

/**
 * Engine type pour ContextSnapshot
 */
export type EngineType = 'corematch-v2' | 'corematch-mcp' | 'corematch-cli';

/**
 * Builder pour créer un ContextSnapshot
 * Usage pratique pour construire progressivement le snapshot
 *
 * @param engine - Engine utilisé ('corematch-v2' par défaut)
 *
 * @example
 * // Orchestrator Next.js classique
 * const builder = new ContextSnapshotBuilder('corematch-v2');
 *
 * @example
 * // Serveur MCP
 * const builder = new ContextSnapshotBuilder('corematch-mcp');
 *
 * @example
 * // CLI tool
 * const builder = new ContextSnapshotBuilder('corematch-cli');
 */
export class ContextSnapshotBuilder {
  private snapshot: Partial<ContextSnapshot> = {};

  constructor(engine: EngineType = 'corematch-v2') {
    // Defaults
    this.snapshot.engine = engine;
    this.snapshot.engine_version = '2.1.0';
    this.snapshot.sessionId = crypto.randomUUID();
    this.snapshot.requestId = crypto.randomUUID();
    this.snapshot.cost_currency = 'USD';
    this.snapshot.providers_called = [];
    this.snapshot.disagreements = [];
    this.snapshot.analysis_started_at = new Date().toISOString();

    // Consent par défaut: false (sécurisé)
    this.snapshot.consent_mcp_checked = false;
  }

  setEngine(engine: EngineType): this {
    this.snapshot.engine = engine;
    return this;
  }

  setSessionId(sessionId: string): this {
    this.snapshot.sessionId = sessionId;
    return this;
  }

  setJobContext(projectId: string, jobTitle: string, jobSpecHash: string): this {
    this.snapshot.projectId = projectId;
    this.snapshot.job_title = jobTitle;
    this.snapshot.jobSpecHash = jobSpecHash;
    return this;
  }

  setMode(mode: AnalysisMode, prefilterEnabled: boolean, packingEnabled: boolean): this {
    this.snapshot.mode = mode;
    this.snapshot.prefilter_enabled = prefilterEnabled;
    this.snapshot.packing_enabled = packingEnabled;
    return this;
  }

  addProviderCall(details: ProviderCallDetails): this {
    this.snapshot.providers_called!.push(details);
    return this;
  }

  setConsensus(level: ConsensusLevel, arbiterUsed: boolean, arbiterReason?: string): this {
    this.snapshot.consensus_level = level;
    this.snapshot.arbiter_used = arbiterUsed;
    this.snapshot.arbiter_reason = arbiterReason;
    return this;
  }

  setDisagreements(disagreements: string[]): this {
    this.snapshot.disagreements = disagreements;
    return this;
  }

  setCost(totalUsd: number): this {
    this.snapshot.cost_total_usd = totalUsd;
    return this;
  }

  setDuration(totalMs: number, extractionMs: number, evaluationMs: number): this {
    this.snapshot.duration_total_ms = totalMs;
    this.snapshot.duration_extraction_ms = extractionMs;
    this.snapshot.duration_evaluation_ms = evaluationMs;
    return this;
  }

  setCompliance(
    piiMaskingLevel: PIIMaskingLevel,
    consentChecked: boolean,
    consentGranted?: boolean
  ): this {
    this.snapshot.pii_masking_level = piiMaskingLevel;
    this.snapshot.consent_mcp_checked = consentChecked;
    this.snapshot.consent_mcp_granted = consentGranted;
    return this;
  }

  /**
   * Vérifier le consent MCP depuis la DB et le mettre dans le snapshot
   *
   * @param candidateId - ID du candidat
   * @returns this (pour chaining)
   *
   * @example
   * const builder = new ContextSnapshotBuilder('corematch-mcp');
   * await builder.setConsentFromDB('candidate-123');
   * // snapshot.consent_mcp_checked = true
   * // snapshot.consent_mcp_granted = true/false (selon DB)
   */
  async setConsentFromDB(candidateId: string): Promise<this> {
    try {
      const { checkMCPConsent } = await import('@/lib/mcp/security/pii-masking');
      const hasConsent = await checkMCPConsent(candidateId);

      this.snapshot.consent_mcp_checked = true;
      this.snapshot.consent_mcp_granted = hasConsent;

      return this;
    } catch (error) {
      console.error('[ContextSnapshotBuilder.setConsentFromDB] Error:', error);
      // En cas d'erreur, marquer comme non vérifié (fail-safe)
      this.snapshot.consent_mcp_checked = false;
      this.snapshot.consent_mcp_granted = false;
      return this;
    }
  }

  /**
   * Obtenir le masking level depuis la config projet et le mettre dans le snapshot
   *
   * @param projectId - ID du projet
   * @returns this (pour chaining)
   *
   * @example
   * const builder = new ContextSnapshotBuilder('corematch-mcp');
   * await builder.setMaskingLevelFromDB('project-123');
   * // snapshot.pii_masking_level = 'partial' (selon config projet)
   */
  async setMaskingLevelFromDB(projectId: string): Promise<this> {
    try {
      const { getProjectPIIMaskingLevel } = await import('@/lib/mcp/security/pii-masking');
      const level = await getProjectPIIMaskingLevel(projectId);

      this.snapshot.pii_masking_level = level;

      return this;
    } catch (error) {
      console.error('[ContextSnapshotBuilder.setMaskingLevelFromDB] Error:', error);
      // En cas d'erreur, utiliser 'partial' (sécurisé)
      this.snapshot.pii_masking_level = 'partial';
      return this;
    }
  }

  setSmartTrigger(reason: string, providersSkipped?: ProviderName[]): this {
    this.snapshot.smart_trigger_reason = reason;
    this.snapshot.providers_skipped = providersSkipped;
    return this;
  }

  setEvidenceQuality(qualitySum: number, minRequired: number, meetsThreshold: boolean): this {
    this.snapshot.evidence_quality_sum = qualitySum;
    this.snapshot.evidence_min_required = minRequired;
    this.snapshot.evidence_meets_threshold = meetsThreshold;
    return this;
  }

  complete(): ContextSnapshot {
    this.snapshot.analysis_completed_at = new Date().toISOString();

    // Validation
    if (!this.snapshot.projectId) throw new Error('projectId is required');
    if (!this.snapshot.job_title) throw new Error('job_title is required');
    if (!this.snapshot.jobSpecHash) throw new Error('jobSpecHash is required');
    if (!this.snapshot.mode) throw new Error('mode is required');
    if (this.snapshot.consensus_level === undefined) throw new Error('consensus_level is required');
    if (this.snapshot.arbiter_used === undefined) throw new Error('arbiter_used is required');
    if (this.snapshot.pii_masking_level === undefined) throw new Error('pii_masking_level is required');
    if (this.snapshot.consent_mcp_checked === undefined)
      throw new Error('consent_mcp_checked is required');

    return this.snapshot as ContextSnapshot;
  }
}

/**
 * Helper pour créer un snapshot complet rapidement
 */
export function createContextSnapshot(params: {
  projectId: string;
  jobTitle: string;
  jobSpecHash: string;
  mode: AnalysisMode;
  providersUsed: ProviderCallDetails[];
  consensusLevel: ConsensusLevel;
  arbiterUsed: boolean;
  costTotal: number;
  durationTotal: number;
  piiMaskingLevel?: PIIMaskingLevel;
}): ContextSnapshot {
  const builder = new ContextSnapshotBuilder();

  return builder
    .setJobContext(params.projectId, params.jobTitle, params.jobSpecHash)
    .setMode(params.mode, true, true)
    .setCost(params.costTotal)
    .setDuration(params.durationTotal, 1000, params.durationTotal - 1000)
    .setConsensus(params.consensusLevel, params.arbiterUsed)
    .setCompliance(params.piiMaskingLevel || 'none', false)
    .complete();
}
