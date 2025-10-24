/**
 * Évaluateur de règles must-have
 *
 * Vérifie si les règles obligatoires (must_have) sont satisfaites
 */

import type { CV_JSON, JobSpec, MustHaveRule, FailedRule, Evidence } from '../types';
import { normalizeText, extractKeywords } from '../utils/normalize';
import { calculateTotalMonths } from '../utils/dates';

/**
 * Évaluer toutes les règles must-have
 */
export function evaluateMustHaveRules(
  cv: CV_JSON,
  jobSpec: JobSpec,
  analysisDate?: string
): {
  meets_all: boolean;
  fails: FailedRule[];
  evidence_by_rule: Record<string, Evidence[]>;
} {
  const fails: FailedRule[] = [];
  const evidenceByRule: Record<string, Evidence[]> = {};

  for (const rule of jobSpec.must_have) {
    const evaluation = evaluateSingleMustHave(cv, rule, jobSpec, analysisDate);

    if (!evaluation.passes) {
      fails.push({
        rule_id: rule.id,
        reason: evaluation.reason,
        evidence: evaluation.evidence,
      });
    }

    evidenceByRule[rule.id] = evaluation.evidence;
  }

  const meetsAll = fails.length === 0;

  return {
    meets_all: meetsAll,
    fails,
    evidence_by_rule: evidenceByRule,
  };
}

/**
 * Évaluer une seule règle must-have
 */
function evaluateSingleMustHave(
  cv: CV_JSON,
  rule: MustHaveRule,
  jobSpec: JobSpec,
  analysisDate?: string
): {
  passes: boolean;
  reason: string;
  evidence: Evidence[];
} {
  const ruleDesc = normalizeText(rule.desc);

  // =========================================================================
  // Règles spéciales : Expérience minimale
  // =========================================================================

  // Détection: "minimum X ans", "au moins X années", etc.
  const yearMatch = ruleDesc.match(/(\d+)\s*(an|annee|year)/);

  if (yearMatch) {
    const requiredYears = parseInt(yearMatch[1], 10);
    return evaluateMinimumExperience(cv, requiredYears, rule, jobSpec, analysisDate);
  }

  // Détection: "X mois d'expérience"
  const monthMatch = ruleDesc.match(/(\d+)\s*mois/);

  if (monthMatch) {
    const requiredMonths = parseInt(monthMatch[1], 10);
    return evaluateMinimumExperienceMonths(cv, requiredMonths, rule, jobSpec, analysisDate);
  }

  // =========================================================================
  // Règles spéciales : Diplôme/Formation requise
  // =========================================================================

  if (ruleDesc.includes('diplome') || ruleDesc.includes('formation') || ruleDesc.includes('master') || ruleDesc.includes('licence')) {
    return evaluateDiploma(cv, rule);
  }

  // =========================================================================
  // Règles spéciales : Compétence requise
  // =========================================================================

  if (ruleDesc.includes('maitrise') || ruleDesc.includes('competence') || ruleDesc.includes('connaissance')) {
    return evaluateSkillRequirement(cv, rule);
  }

  // =========================================================================
  // Règles génériques : Chercher mots-clés dans tout le CV
  // =========================================================================

  return evaluateGenericRule(cv, rule);
}

/**
 * Évaluer règle "minimum X ans d'expérience"
 */
function evaluateMinimumExperience(
  cv: CV_JSON,
  requiredYears: number,
  rule: MustHaveRule,
  jobSpec: JobSpec,
  analysisDate?: string
): {
  passes: boolean;
  reason: string;
  evidence: Evidence[];
} {
  const totalMonths = calculateTotalMonths(
    cv.experiences.map((exp) => ({
      start: exp.date_debut || '',
      end: exp.date_fin === 'en cours' ? null : exp.date_fin,
    })),
    analysisDate
  );

  const actualYears = totalMonths / 12;

  if (actualYears >= requiredYears) {
    return {
      passes: true,
      reason: `Candidat a ${actualYears.toFixed(1)} ans d'expérience (≥ ${requiredYears} ans requis)`,
      evidence: cv.experiences.slice(0, 3).map((exp, idx) => ({
        quote: `${exp.titre} chez ${exp.employeur || 'N/A'} (${exp.date_debut} - ${exp.date_fin || 'en cours'})`,
        field_path: `experiences[${exp.index}]`,
      })),
    };
  }

  return {
    passes: false,
    reason: `Expérience insuffisante: ${actualYears.toFixed(1)} ans (minimum ${requiredYears} ans requis)`,
    evidence: [],
  };
}

/**
 * Évaluer règle "X mois d'expérience"
 */
function evaluateMinimumExperienceMonths(
  cv: CV_JSON,
  requiredMonths: number,
  rule: MustHaveRule,
  jobSpec: JobSpec,
  analysisDate?: string
): {
  passes: boolean;
  reason: string;
  evidence: Evidence[];
} {
  const totalMonths = calculateTotalMonths(
    cv.experiences.map((exp) => ({
      start: exp.date_debut || '',
      end: exp.date_fin === 'en cours' ? null : exp.date_fin,
    })),
    analysisDate
  );

  if (totalMonths >= requiredMonths) {
    return {
      passes: true,
      reason: `Candidat a ${totalMonths} mois d'expérience (≥ ${requiredMonths} mois requis)`,
      evidence: cv.experiences.slice(0, 3).map((exp) => ({
        quote: `${exp.titre}`,
        field_path: `experiences[${exp.index}].titre`,
      })),
    };
  }

  return {
    passes: false,
    reason: `Expérience insuffisante: ${totalMonths} mois (minimum ${requiredMonths} mois requis)`,
    evidence: [],
  };
}

/**
 * Évaluer règle diplôme/formation
 */
function evaluateDiploma(
  cv: CV_JSON,
  rule: MustHaveRule
): {
  passes: boolean;
  reason: string;
  evidence: Evidence[];
} {
  const ruleKeywords = extractKeywords(rule.desc, 2);

  for (const formation of cv.formations) {
    const formationText = [
      formation.intitule,
      formation.etablissement || '',
      formation.niveau || '',
    ].join(' ');

    const formationKeywords = extractKeywords(formationText, 2);

    // Vérifier si des mots-clés correspondent
    const hasMatch = ruleKeywords.some((ruleKey) =>
      formationKeywords.some((formKey) => formKey.includes(ruleKey) || ruleKey.includes(formKey))
    );

    if (hasMatch) {
      return {
        passes: true,
        reason: `Formation correspondante trouvée: ${formation.intitule}`,
        evidence: [
          {
            quote: formation.intitule,
            field_path: `formations[${formation.index}].intitule`,
          },
        ],
      };
    }
  }

  return {
    passes: false,
    reason: `Aucun diplôme correspondant à "${rule.desc}" trouvé`,
    evidence: [],
  };
}

/**
 * Évaluer règle compétence
 */
function evaluateSkillRequirement(
  cv: CV_JSON,
  rule: MustHaveRule
): {
  passes: boolean;
  reason: string;
  evidence: Evidence[];
} {
  const ruleKeywords = extractKeywords(rule.desc, 2);

  // Chercher dans les compétences
  for (const skill of cv.competences) {
    const skillNormalized = normalizeText(skill);

    for (const keyword of ruleKeywords) {
      if (skillNormalized.includes(keyword) || keyword.includes(skillNormalized)) {
        return {
          passes: true,
          reason: `Compétence trouvée: ${skill}`,
          evidence: [
            {
              quote: skill,
              field_path: 'competences',
            },
          ],
        };
      }
    }
  }

  // Chercher dans les missions des expériences
  for (const exp of cv.experiences) {
    if (exp.missions) {
      for (let i = 0; i < exp.missions.length; i++) {
        const mission = exp.missions[i];
        const missionNormalized = normalizeText(mission);

        for (const keyword of ruleKeywords) {
          if (missionNormalized.includes(keyword)) {
            return {
              passes: true,
              reason: `Compétence utilisée en pratique: "${mission}"`,
              evidence: [
                {
                  quote: mission,
                  field_path: `experiences[${exp.index}].missions[${i}]`,
                },
              ],
            };
          }
        }
      }
    }
  }

  return {
    passes: false,
    reason: `Compétence "${rule.desc}" non trouvée`,
    evidence: [],
  };
}

/**
 * Évaluer règle générique (chercher mots-clés partout)
 */
function evaluateGenericRule(
  cv: CV_JSON,
  rule: MustHaveRule
): {
  passes: boolean;
  reason: string;
  evidence: Evidence[];
} {
  const ruleKeywords = extractKeywords(rule.desc, 2);

  // Construire le texte complet du CV
  const cvFullText = [
    ...cv.experiences.flatMap((exp) => [exp.titre, ...(exp.missions || [])]),
    ...cv.formations.map((f) => f.intitule),
    ...cv.competences,
  ].join(' ');

  const cvKeywords = extractKeywords(cvFullText, 2);

  // Vérifier si des mots-clés correspondent
  const hasMatch = ruleKeywords.some((ruleKey) =>
    cvKeywords.some((cvKey) => cvKey.includes(ruleKey) || ruleKey.includes(cvKey))
  );

  if (hasMatch) {
    return {
      passes: true,
      reason: `Règle satisfaite (mots-clés trouvés dans le CV)`,
      evidence: [
        {
          quote: rule.desc,
          field_path: 'generic',
        },
      ],
    };
  }

  return {
    passes: false,
    reason: `Règle non satisfaite: "${rule.desc}"`,
    evidence: [],
  };
}
