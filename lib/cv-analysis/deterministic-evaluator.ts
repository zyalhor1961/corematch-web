/**
 * Évaluateur déterministe de CV - Moteur d'analyse auditable
 * ZERO hallucination - Basé uniquement sur les données structurées
 */

export interface MustHaveRule {
  id: string;
  desc: string;
  severity: 'critical' | 'standard';
}

export interface RelevanceRules {
  direct: string[];
  adjacent: string[];
  peripheral: string[];
}

export interface Weights {
  w_exp: number;
  w_skills: number;
  w_nice: number;
  p_adjacent: number; // Poids pour expériences adjacentes (0-1)
}

export interface Thresholds {
  years_full_score: number;
  shortlist_min: number;
  consider_min: number;
}

export interface JobSpec {
  title: string;
  must_have: MustHaveRule[];
  skills_required: string[];
  nice_to_have: string[];
  relevance_rules: RelevanceRules;
  skills_map?: Record<string, string[]>; // Synonymes/alias
  weights?: Weights;
  thresholds?: Thresholds;
  analysis_date?: string; // YYYY-MM-DD
}

export interface Evidence {
  quote: string;
  field_path: string;
}

export interface FailedRule {
  rule_id: string;
  reason: string;
  evidence: Evidence[];
}

export interface ExperienceRelevance {
  index: number;
  titre: string;
  employeur: string;
  start: string; // YYYY-MM
  end: string | null; // YYYY-MM or null for current
  relevance: 'DIRECTE' | 'ADJACENTE' | 'PERIPHERIQUE' | 'NON_PERTINENTE';
  reason: string;
  evidence: Evidence[];
}

export interface RelevanceSummary {
  months_direct: number;
  months_adjacent: number;
  months_peripheral: number;
  months_non_pertinent: number;
  by_experience: ExperienceRelevance[];
}

export interface Subscores {
  experience_years_relevant: number;
  skills_match_0_to_100: number;
  nice_to_have_0_to_100: number;
}

export interface Strength {
  point: string;
  evidence: Evidence[];
}

export interface Improvement {
  point: string;
  why: string;
  suggested_action: string;
}

export interface EvaluationResult {
  meets_all_must_have: boolean;
  fails: FailedRule[];
  relevance_summary: RelevanceSummary;
  subscores: Subscores;
  overall_score_0_to_100: number;
  recommendation: 'SHORTLIST' | 'CONSIDER' | 'REJECT';
  strengths: Strength[];
  improvements: Improvement[];
  evidence_global: Evidence[];
}

// Poids par défaut
const DEFAULT_WEIGHTS: Weights = {
  w_exp: 0.5,
  w_skills: 0.3,
  w_nice: 0.2,
  p_adjacent: 0.5
};

// Seuils par défaut
const DEFAULT_THRESHOLDS: Thresholds = {
  years_full_score: 3,
  shortlist_min: 75,
  consider_min: 60
};

/**
 * Construit le prompt système pour l'évaluateur GPT
 */
export function buildEvaluatorSystemPrompt(): string {
  return `Vous êtes un évaluateur de candidatures strict, impartial et auditable.
Objectif : juger l'adéquation d'un CV à une fiche de poste en appliquant des règles déterministes et en produisant uniquement un JSON conforme au schéma ci-dessous.
Langue de sortie : français. Aucune hallucination. Si une information manque, indiquer "INFORMATION_MANQUANTE".

Principes

Zéro invention : n'utilisez que les champs présents dans CV_JSON.

Must-have : appliquez toutes les règles de JOB_SPEC.must_have à la lettre. Une règle non satisfaite = lister dans fails.

Pertinence des expériences (taxonomie) :

DIRECTE : même métier/fonction que le poste cible, ou mots-clés de relevance_rules.direct.

ADJACENTE : compétences transférables listées dans relevance_rules.adjacent (ex. interprétariat pour un poste d'enseignant FLE = adjacent, pas direct).

PERIPHERIQUE : même secteur/contexte mais pas la fonction (cf. relevance_rules.peripheral).

NON_PERTINENTE : le reste.

Ancienneté pertinente (mois) : calculez les mois par catégorie (directe/adjacente), en utilisant date_debut / date_fin (ou "en cours" = jusqu'à analysis_date si fournie, sinon "aujourd'hui"). Si des périodes se chevauchent dans la même catégorie, ne comptez pas en double (utilisez l'union).

Sous-scores :

experience_years_relevant = (mois_direct + poids_adjacent*mois_adjacent)/12, avec poids_adjacent provenant de weights.p_adjacent (défaut 0.5).

skills_match_0_to_100 : comparer skills_required à CV_JSON.competences + missions (comptage de recouvrements textuels simples ; si skills_map fourni, utilisez ses alias/synonymes).

nice_to_have_0_to_100 : idem pour nice_to_have.

Score global :
overall = 100 * ( w_exp*score_exp_norm + w_skills*(skills/100) + w_nice*(nice/100) )
où score_exp_norm = min(1, experience_years_relevant / thresholds.years_full_score).
Poids par défaut : w_exp=0.5, w_skills=0.3, w_nice=0.2 (surchargeables via weights).

Recommandation :

Si un must-have critique (severity:"critical") échoue ⇒ "REJECT".

Sinon :

overall ≥ thresholds.shortlist_min ⇒ "SHORTLIST"

overall ≥ thresholds.consider_min ⇒ "CONSIDER"

Sinon ⇒ "REJECT".

Preuves : pour chaque décision clé (expérience/compétence), fournissez quote + field_path du CV_JSON.

Éthique : ignorez âge, origine, genre, état de santé, etc. Si ces infos apparaissent, ne pas les utiliser.

Répondez UNIQUEMENT avec un JSON strictement conforme au schéma suivant, sans markdown, sans explication :

{
  "meets_all_must_have": true,
  "fails": [
    {"rule_id":"M1","reason":"...","evidence":[{"quote":"...","field_path":"..."}]}
  ],
  "relevance_summary": {
    "months_direct": 0,
    "months_adjacent": 0,
    "months_peripheral": 0,
    "months_non_pertinent": 0,
    "by_experience": [
      {
        "index": 0,
        "titre": "...",
        "employeur": "...",
        "start": "YYYY-MM",
        "end": "YYYY-MM|null",
        "relevance": "DIRECTE|ADJACENTE|PERIPHERIQUE|NON_PERTINENTE",
        "reason": "... (1 phrase)",
        "evidence": [{"quote":"...","field_path":"experiences[0].missions[1]"}]
      }
    ]
  },
  "subscores": {
    "experience_years_relevant": 0.0,
    "skills_match_0_to_100": 0,
    "nice_to_have_0_to_100": 0
  },
  "overall_score_0_to_100": 0,
  "recommendation": "SHORTLIST|CONSIDER|REJECT",
  "strengths": [
    {"point":"...","evidence":[{"quote":"...","field_path":"..."}]}
  ],
  "improvements": [
    {"point":"...","why":"...","suggested_action":"..."}
  ],
  "evidence_global": [
    {"aspect":"diplome","quote":"...","field_path":"formations[0].intitule"}
  ]
}`;
}

/**
 * Construit le prompt utilisateur avec JOB_SPEC et CV_JSON
 */
export function buildEvaluatorUserPrompt(jobSpec: JobSpec, cvJson: any): string {
  // Valeurs par défaut
  const weights = { ...DEFAULT_WEIGHTS, ...jobSpec.weights };
  const thresholds = { ...DEFAULT_THRESHOLDS, ...jobSpec.thresholds };

  const completeJobSpec = {
    ...jobSpec,
    weights,
    thresholds,
    analysis_date: jobSpec.analysis_date || new Date().toISOString().split('T')[0]
  };

  return `JOB_SPEC:
${JSON.stringify(completeJobSpec, null, 2)}

CV_JSON:
${JSON.stringify(cvJson, null, 2)}`;
}

/**
 * Crée un JOB_SPEC par défaut basé sur le projet
 */
export function createDefaultJobSpec(project: any): JobSpec {
  const title = project.job_title || project.name || 'Poste non spécifié';

  return {
    title,
    must_have: [
      {
        id: 'M1',
        desc: project.requirements || 'Expérience pertinente dans le domaine',
        severity: 'standard'
      }
    ],
    skills_required: extractSkillsFromText(project.requirements || ''),
    nice_to_have: extractSkillsFromText(project.description || ''),
    relevance_rules: {
      direct: extractKeywordsFromText(title),
      adjacent: [],
      peripheral: []
    },
    weights: DEFAULT_WEIGHTS,
    thresholds: DEFAULT_THRESHOLDS,
    analysis_date: new Date().toISOString().split('T')[0]
  };
}

/**
 * Extrait des compétences d'un texte (simple tokenization)
 */
function extractSkillsFromText(text: string): string[] {
  if (!text) return [];

  // Mots-clés techniques courants
  const keywords = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
  return [...new Set(keywords)]
    .filter(k => k.length > 3)
    .slice(0, 10); // Max 10 compétences
}

/**
 * Extrait des mots-clés pour relevance_rules
 */
function extractKeywordsFromText(text: string): string[] {
  if (!text) return [];
  return text.toLowerCase().split(/[\s,;]+/).filter(k => k.length > 2);
}

/**
 * Parse le résultat JSON de l'évaluation avec validation stricte
 */
export function parseEvaluationResult(jsonString: string): EvaluationResult {
  try {
    // Nettoyer les éventuels wrapper markdown
    const cleaned = jsonString
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const result = JSON.parse(cleaned) as EvaluationResult;

    // Validation basique
    if (typeof result.overall_score_0_to_100 !== 'number') {
      throw new Error('Invalid overall_score');
    }

    if (!['SHORTLIST', 'CONSIDER', 'REJECT'].includes(result.recommendation)) {
      throw new Error('Invalid recommendation');
    }

    return result;
  } catch (error) {
    console.error('Failed to parse evaluation result:', error);
    throw new Error('Invalid evaluation JSON format');
  }
}

/**
 * Convertit le résultat d'évaluation en format legacy pour compatibilité UI
 */
export function convertToLegacyFormat(evaluation: EvaluationResult): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
  summary: string;
  shortlist: boolean;
} {
  return {
    score: Math.round(evaluation.overall_score_0_to_100),
    strengths: evaluation.strengths.map(s => s.point),
    weaknesses: evaluation.improvements.map(i => `${i.point} - ${i.why}`),
    recommendation: evaluation.recommendation,
    summary: generateSummary(evaluation),
    shortlist: evaluation.recommendation === 'SHORTLIST'
  };
}

/**
 * Génère un résumé textuel de l'évaluation
 */
function generateSummary(evaluation: EvaluationResult): string {
  const { overall_score_0_to_100, recommendation, subscores, relevance_summary } = evaluation;

  const expYears = subscores.experience_years_relevant.toFixed(1);
  const directMonths = relevance_summary.months_direct;
  const adjacentMonths = relevance_summary.months_adjacent;

  let summary = `Score global : ${Math.round(overall_score_0_to_100)}/100. `;

  if (recommendation === 'SHORTLIST') {
    summary += '✅ Candidat fortement recommandé. ';
  } else if (recommendation === 'CONSIDER') {
    summary += '⚠️ Candidat à considérer avec réserves. ';
  } else {
    summary += '❌ Candidat non recommandé pour ce poste. ';
  }

  summary += `Expérience pertinente : ${expYears} an(s) (${directMonths} mois directs`;
  if (adjacentMonths > 0) {
    summary += `, ${adjacentMonths} mois adjacents`;
  }
  summary += '). ';

  summary += `Compétences : ${subscores.skills_match_0_to_100}% de correspondance. `;

  if (evaluation.fails.length > 0) {
    const criticalFails = evaluation.fails.filter(f =>
      f.rule_id.includes('critical') || f.reason.includes('critique')
    );
    if (criticalFails.length > 0) {
      summary += `⚠️ ${criticalFails.length} critère(s) critique(s) non satisfait(s). `;
    }
  }

  return summary;
}
