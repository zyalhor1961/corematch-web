/**
 * Interface de base pour tous les providers IA
 * OpenAI, Gemini, Claude doivent implémenter cette interface
 */

import type {
  CV_JSON,
  JobSpec,
  EvaluationResult,
  ProviderName,
  ProviderResult,
} from '../types';
import type { OrgAISettings, AIInstructionDomain } from '@/lib/types';

/**
 * =============================================================================
 * DOMAIN INSTRUCTION MAPPING
 * =============================================================================
 * Edit this section to change which org_ai_settings field is used for each
 * prompt domain. When adding a new domain, add a mapping here.
 *
 * Usage: getOrgInstructions(settings, 'cv') → returns cv_instructions or general
 * =============================================================================
 */
const DOMAIN_INSTRUCTION_MAP: Record<AIInstructionDomain, keyof OrgAISettings> = {
  cv: 'cv_instructions',
  daf: 'daf_instructions',
  deb: 'deb_instructions',
  general: 'general_instructions',
} as const;

/**
 * Get the appropriate org instruction for a given domain.
 * Falls back to general_instructions if domain-specific instruction is empty.
 *
 * @param settings - The org AI settings (can be null)
 * @param domain - The instruction domain ('cv', 'daf', 'deb', 'general')
 * @returns The instruction string or null if none exists
 */
export function getOrgInstructions(
  settings: OrgAISettings | null | undefined,
  domain: AIInstructionDomain
): string | null {
  if (!settings) return null;

  // Get domain-specific instruction
  const fieldName = DOMAIN_INSTRUCTION_MAP[domain];
  const domainInstruction = settings[fieldName] as string | null | undefined;

  // If domain instruction exists and is not empty, use it
  if (domainInstruction && domainInstruction.trim()) {
    return domainInstruction.trim();
  }

  // Fall back to general instructions
  if (domain !== 'general' && settings.general_instructions?.trim()) {
    return settings.general_instructions.trim();
  }

  return null;
}

/**
 * Configuration commune à tous les providers
 */
export interface BaseProviderConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens?: number;
  timeout?: number; // ms
}

/**
 * Interface abstraite pour un provider IA
 */
export abstract class BaseProvider {
  protected config: BaseProviderConfig;
  public readonly name: ProviderName;

  constructor(name: ProviderName, config: BaseProviderConfig) {
    this.name = name;
    this.config = config;
  }

  /**
   * Analyser un CV (Pass 2)
   * @param cvJson CV extrait et structuré
   * @param jobSpec Spécification du poste
   * @param orgAISettings Optional organization AI settings for custom instructions
   * @returns Résultat d'évaluation + métadonnées
   */
  abstract analyze(
    cvJson: CV_JSON,
    jobSpec: JobSpec,
    orgAISettings?: OrgAISettings | null
  ): Promise<ProviderResult>;

  /**
   * Extraire un CV en JSON (Pass 1)
   * Optionnel: seul le provider principal (OpenAI) implémente ça
   */
  async extract?(cvText: string): Promise<CV_JSON>;

  /**
   * Arbitrer entre plusieurs résultats (Juge)
   * Optionnel: seul le provider arbitre implémente ça
   */
  async arbitrate?(
    providersResults: Record<ProviderName, EvaluationResult>,
    jobSpec: JobSpec
  ): Promise<EvaluationResult>;

  /**
   * Helper: construire le prompt système universel
   * @param orgInstructions - Optional organization-specific instructions to inject
   */
  protected buildSystemPrompt(orgInstructions?: string | null): string {
    // Build the org instructions section if provided
    const orgInstructionsSection = orgInstructions
      ? `
**INSTRUCTIONS SPÉCIFIQUES DE L'ORGANISATION:**
${orgInstructions}

---
`
      : '';

    return `Tu es un évaluateur de candidatures strict, impartial et auditable pour TOUS LES MÉTIERS.
${orgInstructionsSection}

**PRINCIPES FONDAMENTAUX:**

1. **Zéro invention** : Utilise UNIQUEMENT les données présentes dans CV_JSON
2. **Preuves obligatoires** : Chaque décision doit avoir des evidence avec quote + field_path
3. **Taxonomie de pertinence** :
   - DIRECTE : Même métier/fonction que le poste cible
   - ADJACENTE : Compétences transférables, secteur proche
   - PÉRIPHÉRIQUE : Même secteur mais fonction différente
   - NON_PERTINENTE : Hors sujet

4. **Calcul des mois** : Date début → Date fin (ou aujourd'hui si "en cours")
5. **Must-have** : Règles qui DOIVENT être satisfaites
   - severity "critical" → échec = REJECT automatique
   - severity "standard" → échec noté mais pas éliminatoire

**SCORING:**

subscores.experience_years_relevant = (mois_direct + p_adjacent * mois_adjacent) / 12
  où p_adjacent vient de weights.p_adjacent (défaut 0.5)

subscores.skills_match_0_to_100 = % compétences CV présentes dans skills_required (ENTIER)

subscores.nice_to_have_0_to_100 = % compétences CV présentes dans nice_to_have (ENTIER)

score_exp_norm = min(1, experience_years_relevant / thresholds.years_full_score)

overall_score_0_to_100 = 100 * (w_exp * score_exp_norm + w_skills * (skills/100) + w_nice * (nice/100))

**RECOMMANDATION:**
- Si un must-have "critical" échoue → REJECT
- Sinon si overall ≥ thresholds.shortlist_min → SHORTLIST
- Sinon si overall ≥ thresholds.consider_min → CONSIDER
- Sinon → REJECT

**SCHÉMA JSON DE SORTIE (STRICTEMENT OBLIGATOIRE):**
{
  "meets_all_must_have": boolean,
  "fails": [
    {
      "rule_id": "string",
      "reason": "string",
      "evidence": [{ "quote": "string", "field_path": "string" }]
    }
  ],
  "relevance_summary": {
    "months_direct": integer,
    "months_adjacent": integer,
    "months_peripheral": integer,
    "months_non_pertinent": integer,
    "by_experience": [
      {
        "index": integer,
        "titre": "string",
        "relevance": "DIRECTE|ADJACENTE|PERIPHERIQUE|NON_PERTINENTE",
        "reason": "string",
        "months": integer,
        "evidence": [{ "quote": "string", "field_path": "string" }]
      }
    ]
  },
  "subscores": {
    "experience_years_relevant": number (décimal),
    "skills_match_0_to_100": integer (0-100),
    "nice_to_have_0_to_100": integer (0-100)
  },
  "overall_score_0_to_100": number (décimal 0-100),
  "recommendation": "SHORTLIST|CONSIDER|REJECT",
  "strengths": [
    {
      "category": "string",
      "point": "string",
      "evidence": [{ "quote": "string", "field_path": "string" }]
    }
  ],
  "improvements": [
    {
      "point": "string",
      "why": "string",
      "suggested_action": "string"
    }
  ],
  "evidence_global": [
    {
      "quote": "string",
      "field_path": "string"
    }
  ] (optionnel)
}

**IMPORTANT:**
- "fails" doit être un array (vide si aucun échec)
- "skills_match_0_to_100" et "nice_to_have_0_to_100" doivent être des ENTIERS (0-100)
- "relevance_summary.by_experience" doit contenir TOUTES les expériences du CV
- Chaque "evidence" doit avoir un "quote" extrait du CV et un "field_path" (ex: "experiences[0].missions[1]")
- "strengths" et "improvements" doivent être des arrays non vides

Réponds UNIQUEMENT avec un JSON valide conforme au schéma. Pas de markdown, pas de commentaire.`;
  }

  /**
   * Helper: construire le prompt utilisateur
   */
  protected buildUserPrompt(cvJson: CV_JSON, jobSpec: JobSpec): string {
    return `JOB_SPEC:
${JSON.stringify(jobSpec, null, 2)}

CV_JSON:
${JSON.stringify(cvJson, null, 2)}`;
  }

  /**
   * Helper: calculer le coût estimé d'un appel
   */
  protected calculateCost(tokensInput: number, tokensOutput: number): number {
    // Implémentation spécifique à chaque provider
    return 0;
  }

  /**
   * Helper: logger les erreurs
   */
  protected logError(error: unknown, context: string): void {
    console.error(`[${this.name}] Error in ${context}:`, error);
  }
}

/**
 * Factory function pour créer un provider
 */
export type ProviderFactory = (config: BaseProviderConfig) => BaseProvider;

/**
 * Registry des providers disponibles
 */
export class ProviderRegistry {
  private static providers = new Map<ProviderName, ProviderFactory>();

  static register(name: ProviderName, factory: ProviderFactory): void {
    this.providers.set(name, factory);
  }

  static create(name: ProviderName, config: BaseProviderConfig): BaseProvider {
    const factory = this.providers.get(name);
    if (!factory) {
      throw new Error(`[ProviderRegistry] Unknown provider: ${name}`);
    }
    return factory(config);
  }

  static isRegistered(name: ProviderName): boolean {
    return this.providers.has(name);
  }

  static getAvailable(): ProviderName[] {
    return Array.from(this.providers.keys());
  }
}
