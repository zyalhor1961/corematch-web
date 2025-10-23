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

// Poids par défaut (ajustés pour être plus équilibrés)
const DEFAULT_WEIGHTS: Weights = {
  w_exp: 0.55,     // 55% expérience (prioritaire mais pas écrasant)
  w_skills: 0.30,  // 30% compétences (plus important pour détecter les vrais profils)
  w_nice: 0.15,    // 15% nice-to-have
  p_adjacent: 0.5  // Expériences adjacentes valorisées à 50%
};

// Seuils par défaut (plus réalistes)
const DEFAULT_THRESHOLDS: Thresholds = {
  years_full_score: 2,  // 100% à partir de 2 ans (au lieu de 3)
  shortlist_min: 65,    // SHORTLIST à partir de 65% (au lieu de 75%)
  consider_min: 50      // CONSIDER à partir de 50% (au lieu de 60%)
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
⚠️ IMPORTANT : Pour les exigences d'expérience, vérifiez le TOTAL CUMULÉ (somme de toutes les périodes pertinentes), PAS la période continue la plus longue.
Exemple : si la règle demande "24 mois cumulés d'enseignement FLE", additionnez TOUS les mois d'expérience DIRECTE en FLE, même si ce sont des missions courtes espacées.

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
Poids par défaut : w_exp=0.55, w_skills=0.30, w_nice=0.15 (surchargeables via weights).

Recommandation :

Si un must-have critique (severity:"critical") échoue ⇒ "REJECT".

Sinon :

overall ≥ thresholds.shortlist_min ⇒ "SHORTLIST"

overall ≥ thresholds.consider_min ⇒ "CONSIDER"

Sinon ⇒ "REJECT".

Points forts & améliorations :
- Générez AU MINIMUM 2 points forts et 2 axes d'amélioration
- Si vous en trouvez moins, développez des variantes ou ajoutez des points génériques pertinents
- Soyez constructif et précis dans vos formulations

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
 * Types de domaines professionnels détectables
 */
type JobDomain = 'fle' | 'tech' | 'finance' | 'healthcare' | 'sales' | 'marketing' | 'hr' | 'generic';

/**
 * Configuration pour un domaine professionnel
 */
interface DomainConfig {
  keywords: string[]; // Mots-clés pour détecter ce domaine
  relevanceRules: RelevanceRules;
  skillsRequired: string[];
  niceToHave: string[];
  skillsMap: Record<string, string[]>;
  mustHaveTemplate: string;
  yearsFullScore?: number; // Optionnel: années pour 100%
}

/**
 * Templates de domaines professionnels
 */
const DOMAIN_TEMPLATES: Record<JobDomain, DomainConfig> = {
  fle: {
    keywords: ['fle', 'français langue étrangère', 'formateur fle', 'enseignant fle', 'didactique du fle'],
    relevanceRules: {
      direct: [
        'formateur fle', 'formatrice fle', 'enseignant fle', 'enseignante fle',
        'professeur fle', 'professeure de français', 'assistant fle', 'assistante fle',
        'lecteur fle', 'lectrice fle', 'alliance française', 'ifra', 'crept',
        'université', 'français langue étrangère', 'fle', 'didactique du fle',
        'enseignement du français'
      ],
      adjacent: [
        'interprète', 'traducteur', 'traductrice', 'médiateur social',
        'médiatrice sociale', 'assistant éducation', 'assistante éducation',
        'tuteur', 'tutorat', 'alphabétisation', 'médiateur culturel',
        'formateur', 'formatrice', 'enseignant', 'enseignante', 'professeur'
      ],
      peripheral: [
        'éducation', 'formation', 'enseignement', 'pédagogie',
        'école', 'collège', 'lycée', 'animation'
      ]
    },
    skillsRequired: ['conception de cours', 'évaluation', 'gestion de classe', 'didactique', 'cecrl'],
    niceToHave: ['delf', 'dalf', 'tcf', 'tice', 'numérique', 'interculturel'],
    skillsMap: {
      'conception de cours': ['ingénierie pédagogique', 'séquences pédagogiques', 'préparer des séances', 'outils pédagogiques', 'fiches pédagogiques'],
      'évaluation': ['évaluer les apprenants', 'examens', 'barèmes', 'cecrl', 'delf', 'dalf', 'tcf'],
      'gestion de classe': ['animer des cours', 'animation de groupe', 'formation adultes', 'public migrant', 'collège', 'lycée'],
      'didactique': ['méthodologie', 'approche communicative', 'approche actionnelle', 'pédagogie'],
      'français': ['fle', 'langue française', 'grammaire', 'phonétique', 'linguistique']
    },
    mustHaveTemplate: 'Au moins 24 mois cumulés d\'enseignement FLE en établissement scolaire, université ou centre agréé',
    yearsFullScore: 2
  },

  tech: {
    keywords: ['développeur', 'developer', 'ingénieur', 'engineer', 'programmeur', 'devops', 'data scientist', 'analyste', 'tech lead', 'cto', 'architecte logiciel'],
    relevanceRules: {
      direct: [
        'développeur', 'developer', 'ingénieur logiciel', 'software engineer',
        'programmeur', 'data scientist', 'devops', 'sre', 'tech lead',
        'architecte logiciel', 'full stack', 'backend', 'frontend', 'mobile'
      ],
      adjacent: [
        'analyste', 'consultant technique', 'chef de projet technique',
        'product manager tech', 'qa engineer', 'testeur', 'support technique',
        'administrateur système', 'sysadmin'
      ],
      peripheral: [
        'informatique', 'technologie', 'digital', 'numérique',
        'startup', 'tech', 'agile', 'scrum'
      ]
    },
    skillsRequired: ['développement', 'programmation', 'architecture', 'debugging', 'git'],
    niceToHave: ['ci/cd', 'docker', 'kubernetes', 'cloud', 'agile', 'tests unitaires'],
    skillsMap: {
      'développement': ['dev', 'coding', 'programming', 'développement logiciel'],
      'programmation': ['coding', 'dev', 'développement'],
      'javascript': ['js', 'ecmascript', 'es6', 'node', 'nodejs'],
      'typescript': ['ts'],
      'python': ['py'],
      'react': ['reactjs', 'react.js', 'react native'],
      'angular': ['angularjs'],
      'vue': ['vuejs', 'vue.js'],
      'docker': ['conteneurisation', 'containerization'],
      'kubernetes': ['k8s', 'orchestration'],
      'git': ['github', 'gitlab', 'version control', 'vcs'],
      'ci/cd': ['intégration continue', 'déploiement continu', 'devops'],
      'cloud': ['aws', 'azure', 'gcp', 'cloud computing'],
      'base de données': ['sql', 'nosql', 'postgresql', 'mongodb', 'database']
    },
    mustHaveTemplate: 'Au moins 24 mois d\'expérience en développement logiciel ou poste technique équivalent',
    yearsFullScore: 3
  },

  finance: {
    keywords: ['comptable', 'financier', 'analyste financier', 'contrôleur de gestion', 'auditeur', 'trésorier', 'fiscaliste'],
    relevanceRules: {
      direct: [
        'comptable', 'financier', 'analyste financier', 'contrôleur de gestion',
        'auditeur', 'commissaire aux comptes', 'trésorier', 'fiscaliste',
        'directeur financier', 'daf', 'cfo', 'expert-comptable'
      ],
      adjacent: [
        'assistant comptable', 'gestionnaire', 'analyste',
        'contrôleur', 'consultant financier', 'conseiller financier'
      ],
      peripheral: [
        'banque', 'assurance', 'finance', 'comptabilité',
        'gestion', 'audit', 'cabinet comptable'
      ]
    },
    skillsRequired: ['comptabilité', 'analyse financière', 'reporting', 'excel', 'normes comptables'],
    niceToHave: ['ifrs', 'us gaap', 'sage', 'sap', 'power bi', 'fiscalité'],
    skillsMap: {
      'comptabilité': ['compta', 'accounting', 'tenue de comptes'],
      'analyse financière': ['financial analysis', 'analyse', 'modélisation financière'],
      'excel': ['microsoft excel', 'tableur', 'spreadsheet'],
      'reporting': ['rapports', 'tableaux de bord', 'dashboard'],
      'normes comptables': ['ifrs', 'us gaap', 'pcg', 'plan comptable'],
      'erp': ['sap', 'oracle', 'sage', 'cegid'],
      'fiscalité': ['tax', 'impôts', 'tva', 'is']
    },
    mustHaveTemplate: 'Au moins 24 mois d\'expérience en comptabilité, finance ou audit',
    yearsFullScore: 3
  },

  healthcare: {
    keywords: ['infirmier', 'médecin', 'aide-soignant', 'pharmacien', 'kinésithérapeute', 'dentiste', 'psychologue', 'sage-femme'],
    relevanceRules: {
      direct: [
        'infirmier', 'infirmière', 'médecin', 'docteur', 'aide-soignant',
        'aide-soignante', 'pharmacien', 'pharmacienne', 'kinésithérapeute',
        'dentiste', 'psychologue', 'sage-femme', 'manipulateur radio'
      ],
      adjacent: [
        'auxiliaire de santé', 'assistant médical', 'secrétaire médicale',
        'brancardier', 'ambulancier', 'préparateur en pharmacie'
      ],
      peripheral: [
        'santé', 'médical', 'hôpital', 'clinique', 'ehpad',
        'soins', 'patient', 'sanitaire'
      ]
    },
    skillsRequired: ['soins', 'diagnostic', 'protocoles médicaux', 'hygiène', 'relation patient'],
    niceToHave: ['urgences', 'réanimation', 'pédiatrie', 'gériatrie', 'spécialisation'],
    skillsMap: {
      'soins': ['nursing', 'care', 'prise en charge'],
      'diagnostic': ['diagnostique', 'évaluation clinique'],
      'protocoles médicaux': ['procédures', 'guidelines', 'référentiels'],
      'hygiène': ['asepsie', 'stérilisation', 'prévention infection'],
      'relation patient': ['communication', 'empathie', 'accompagnement']
    },
    mustHaveTemplate: 'Diplôme requis + au moins 12 mois d\'expérience en milieu de soins',
    yearsFullScore: 2
  },

  sales: {
    keywords: ['commercial', 'vendeur', 'business developer', 'account manager', 'ingénieur commercial', 'technico-commercial'],
    relevanceRules: {
      direct: [
        'commercial', 'commerciale', 'vendeur', 'vendeuse',
        'business developer', 'account manager', 'ingénieur commercial',
        'technico-commercial', 'directeur commercial', 'responsable commercial'
      ],
      adjacent: [
        'assistant commercial', 'conseiller clientèle', 'chargé de clientèle',
        'relation client', 'customer success', 'support vente'
      ],
      peripheral: [
        'vente', 'commerce', 'négociation', 'client',
        'prospection', 'retail', 'magasin'
      ]
    },
    skillsRequired: ['prospection', 'négociation', 'closing', 'relation client', 'crm'],
    niceToHave: ['salesforce', 'b2b', 'b2c', 'hunter', 'farmer', 'grands comptes'],
    skillsMap: {
      'prospection': ['prospecting', 'lead generation', 'développement commercial'],
      'négociation': ['negotiation', 'argumentation', 'closing'],
      'relation client': ['customer relationship', 'service client', 'fidélisation'],
      'crm': ['salesforce', 'hubspot', 'zoho', 'gestion client'],
      'b2b': ['business to business', 'entreprise'],
      'b2c': ['business to consumer', 'grand public']
    },
    mustHaveTemplate: 'Au moins 24 mois d\'expérience en vente ou développement commercial',
    yearsFullScore: 2
  },

  marketing: {
    keywords: ['marketing', 'communication', 'digital marketing', 'community manager', 'content manager', 'seo', 'sem', 'social media'],
    relevanceRules: {
      direct: [
        'marketing', 'digital marketing', 'responsable marketing',
        'chef de produit', 'product marketing', 'community manager',
        'content manager', 'seo', 'sem', 'social media manager',
        'growth hacker', 'traffic manager'
      ],
      adjacent: [
        'communication', 'chargé de communication', 'assistant marketing',
        'brand manager', 'event manager', 'relations publiques'
      ],
      peripheral: [
        'publicité', 'médias', 'digital', 'web',
        'réseaux sociaux', 'contenu', 'marque'
      ]
    },
    skillsRequired: ['stratégie marketing', 'digital', 'analytics', 'content', 'réseaux sociaux'],
    niceToHave: ['seo', 'sem', 'google ads', 'facebook ads', 'marketing automation', 'growth hacking'],
    skillsMap: {
      'digital': ['numérique', 'web', 'online', 'digital marketing'],
      'analytics': ['google analytics', 'data analysis', 'kpi', 'metrics'],
      'seo': ['référencement naturel', 'search engine optimization'],
      'sem': ['référencement payant', 'sea', 'google ads'],
      'réseaux sociaux': ['social media', 'facebook', 'instagram', 'linkedin', 'twitter'],
      'content': ['contenu', 'rédaction', 'content marketing'],
      'email marketing': ['emailing', 'newsletter', 'mailchimp'],
      'crm': ['hubspot', 'salesforce', 'relation client']
    },
    mustHaveTemplate: 'Au moins 24 mois d\'expérience en marketing digital ou communication',
    yearsFullScore: 2
  },

  hr: {
    keywords: ['ressources humaines', 'rh', 'recrutement', 'talent acquisition', 'hr', 'chargé de recrutement', 'responsable rh', 'drh'],
    relevanceRules: {
      direct: [
        'ressources humaines', 'rh', 'hr', 'recrutement', 'recruteur',
        'recruteuse', 'talent acquisition', 'chargé de recrutement',
        'responsable rh', 'drh', 'directeur ressources humaines',
        'gestionnaire rh', 'hr business partner'
      ],
      adjacent: [
        'assistant rh', 'chargé de formation', 'développement rh',
        'gestionnaire paie', 'administration du personnel', 'responsable formation'
      ],
      peripheral: [
        'formation', 'gestion des talents', 'paie', 'social',
        'droit du travail', 'qvt', 'marque employeur'
      ]
    },
    skillsRequired: ['recrutement', 'entretien', 'sourcing', 'gestion rh', 'droit du travail'],
    niceToHave: ['ats', 'linkedin recruiter', 'assessment', 'talent management', 'hris'],
    skillsMap: {
      'recrutement': ['recruitment', 'hiring', 'talent acquisition'],
      'sourcing': ['chasse', 'recherche candidats', 'talent sourcing'],
      'entretien': ['interview', 'entretien de recrutement'],
      'ats': ['applicant tracking system', 'logiciel recrutement'],
      'linkedin recruiter': ['linkedin', 'réseautage professionnel'],
      'gestion rh': ['administration rh', 'sirh', 'hris'],
      'paie': ['payroll', 'gestion paie', 'salaires'],
      'formation': ['training', 'développement compétences', 'learning']
    },
    mustHaveTemplate: 'Au moins 24 mois d\'expérience en ressources humaines ou recrutement',
    yearsFullScore: 2
  },

  generic: {
    keywords: [],
    relevanceRules: {
      direct: [],
      adjacent: [],
      peripheral: []
    },
    skillsRequired: [],
    niceToHave: [],
    skillsMap: {},
    mustHaveTemplate: 'Expérience pertinente dans le domaine'
  }
};

/**
 * Détecte le domaine professionnel d'un poste
 */
function detectJobDomain(project: any): JobDomain {
  const title = (project.job_title || project.name || '').toLowerCase();
  const requirements = (project.requirements || '').toLowerCase();
  const description = (project.description || '').toLowerCase();
  const combinedText = `${title} ${requirements} ${description}`;

  // Tester chaque domaine (sauf generic)
  const domains = Object.keys(DOMAIN_TEMPLATES).filter(d => d !== 'generic') as JobDomain[];

  for (const domain of domains) {
    const config = DOMAIN_TEMPLATES[domain];
    const matchCount = config.keywords.filter(keyword =>
      combinedText.includes(keyword.toLowerCase())
    ).length;

    // Si au moins 1 mot-clé correspond, on a trouvé le domaine
    if (matchCount > 0) {
      console.log(`[Domain Detection] Detected: ${domain.toUpperCase()} (${matchCount} keywords matched)`);
      return domain;
    }
  }

  console.log('[Domain Detection] No specific domain detected, using GENERIC template');
  return 'generic';
}

/**
 * Crée un JOB_SPEC par défaut basé sur le projet - GÉNÉRIQUE
 *
 * IMPORTANT: Cette fonction crée un jobSpec minimal sans règles spécifiques.
 * Les projets doivent définir leur propre job_spec_config avec leurs règles must_have.
 * Les templates de domaines (FLE, Tech, etc.) sont disponibles comme AIDE à la création,
 * mais ne sont JAMAIS appliqués automatiquement.
 */
export function createDefaultJobSpec(project: any): JobSpec {
  const title = project.job_title || project.name || 'Poste non spécifié';
  const titleKeywords = extractKeywordsFromText(title);

  const relevanceRules: RelevanceRules = {
    direct: titleKeywords,
    adjacent: [],
    peripheral: []
  };

  return {
    title,
    must_have: [], // AUCUNE règle par défaut - le projet doit les définir dans job_spec_config
    skills_required: extractSkillsFromText(project.requirements || ''),
    nice_to_have: extractSkillsFromText(project.description || ''),
    relevance_rules: relevanceRules,
    skills_map: undefined,
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
 * Parse le résultat JSON de l'évaluation avec validation stricte et post-processing
 */
export function parseEvaluationResult(jsonString: string, cvJson?: any, jobSpec?: JobSpec): EvaluationResult {
  try {
    // Nettoyer les éventuels wrapper markdown
    const cleaned = jsonString
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let result = JSON.parse(cleaned) as EvaluationResult;

    // Validation basique
    if (typeof result.overall_score_0_to_100 !== 'number') {
      throw new Error('Invalid overall_score');
    }

    if (!['SHORTLIST', 'CONSIDER', 'REJECT'].includes(result.recommendation)) {
      throw new Error('Invalid recommendation');
    }

    // Post-processing obligatoire
    result = applyPostProcessing(result, cvJson, jobSpec);

    return result;
  } catch (error) {
    console.error('Failed to parse evaluation result:', error);
    throw new Error('Invalid evaluation JSON format');
  }
}

/**
 * Force la vérification stricte de la règle M1 (24 mois cumulés)
 * PRIORITÉ: Cette vérification override le GPT pour garantir la cohérence
 * NOTE: Ne s'applique QUE si M1 existe dans le jobSpec (spécifique domaine FLE)
 */
function enforceM1Rule(evaluation: EvaluationResult, jobSpec?: JobSpec): EvaluationResult {
  // Vérifier si la règle M1 existe dans le jobSpec
  // Si pas de jobSpec ou pas de M1, ne rien faire
  if (!jobSpec || !jobSpec.must_have.some(rule => rule.id === 'M1')) {
    return evaluation;
  }

  const monthsDirect = evaluation.relevance_summary.months_direct || 0;

  // Règle M1: ≥ 24 mois cumulés FLE
  const m1FailIndex = evaluation.fails.findIndex(f => f.rule_id === 'M1');
  const m1Failed = m1FailIndex >= 0 ? evaluation.fails[m1FailIndex] : null;

  if (monthsDirect >= 24) {
    // ✅ PASSE la règle M1
    // Retirer M1 de fails si présent
    if (m1FailIndex >= 0) {
      evaluation.fails.splice(m1FailIndex, 1);
    }

    // Recalculer meets_all_must_have
    evaluation.meets_all_must_have = evaluation.fails.filter(f => f.rule_id.startsWith('M')).length === 0;

    // Déplacer preuves M1 vers strengths si elles existent
    if (m1Failed && m1Failed.evidence.length > 0) {
      const experienceStrength = {
        point: `Expérience FLE validée: ${monthsDirect} mois cumulés d'enseignement`,
        evidence: m1Failed.evidence
      };
      // Ajouter au début des strengths (haute priorité)
      evaluation.strengths.unshift(experienceStrength);
    }
  } else {
    // ❌ ÉCHOUE la règle M1
    // Ajouter M1 à fails si pas déjà présent
    if (!m1Failed) {
      evaluation.fails.push({
        rule_id: 'M1',
        reason: `Moins de 24 mois cumulés d'enseignement FLE requis (${monthsDirect} mois détectés)`,
        evidence: []
      });
    } else {
      // Mettre à jour la raison avec le nombre exact de mois
      evaluation.fails[m1FailIndex].reason =
        `Moins de 24 mois cumulés d'enseignement FLE requis (${monthsDirect} mois détectés)`;
    }

    // Forcer meets_all_must_have = false
    evaluation.meets_all_must_have = false;
  }

  return evaluation;
}

/**
 * Applique les améliorations post-GPT à l'évaluation
 */
function applyPostProcessing(evaluation: EvaluationResult, cvJson?: any, jobSpec?: JobSpec): EvaluationResult {
  // 0. CRITIQUE: Vérification stricte des règles must_have SI APPLICABLES
  // Cette étape override le GPT pour garantir la cohérence
  // Ne s'applique QUE si les règles existent dans le jobSpec du projet
  evaluation = enforceM1Rule(evaluation, jobSpec);

  // NOTE: Détection de diplômes/certifications spécifiques supprimée
  // Chaque projet doit définir ses propres critères dans job_spec_config
  // Le système est maintenant complètement générique

  // 1. Garantir minimum 2 points forts
  while (evaluation.strengths.length < 2) {
    if (evaluation.strengths.length === 0) {
      evaluation.strengths.push({
        point: 'Profil correspondant aux critères de base du poste',
        evidence: []
      });
    } else {
      // Dupliquer et varier le premier point
      const variant = {
        point: `${evaluation.strengths[0].point} (aspect complémentaire)`,
        evidence: evaluation.strengths[0].evidence
      };
      evaluation.strengths.push(variant);
    }
  }

  // 2. Garantir minimum 2 axes d'amélioration
  while (evaluation.improvements.length < 2) {
    if (evaluation.improvements.length === 0) {
      evaluation.improvements.push({
        point: 'Renforcer les compétences techniques spécifiques au poste',
        why: 'Pour mieux répondre aux exigences détaillées',
        suggested_action: 'Se former sur les outils et méthodologies du domaine'
      });
    } else {
      evaluation.improvements.push({
        point: 'Développer l\'expérience pratique dans le domaine cible',
        why: 'Pour consolider le profil',
        suggested_action: 'Multiplier les missions courtes ou stages ciblés'
      });
    }
  }

  // 3. Ajouter exp_total_years dans subscores
  const monthsDirect = evaluation.relevance_summary.months_direct || 0;
  const monthsAdjacent = evaluation.relevance_summary.months_adjacent || 0;
  const expTotalYears = (monthsDirect + 0.5 * monthsAdjacent) / 12;

  // Ajouter au résultat (TypeScript peut ne pas avoir ce champ dans l'interface)
  (evaluation.subscores as any).exp_total_years = parseFloat(expTotalYears.toFixed(2));

  return evaluation;
}

/**
 * @deprecated FONCTION NON UTILISÉE - Logique métier-spécifique retirée
 *
 * Version interne de detectFLEDiplomasInCV (pour éviter dépendance circulaire)
 * CETTE FONCTION N'EST PLUS APPELÉE depuis la généricisation du système.
 *
 * Gardée temporairement pour référence. Les projets doivent maintenant définir
 * leurs propres critères de certification/diplôme dans job_spec_config.
 */
function detectFLEDiplomasInCVInternal(formations: any[]): Array<{ diploma: string; quote: string; field_path: string }> {
  if (!formations || !Array.isArray(formations)) return [];

  const detected: Array<{ diploma: string; quote: string; field_path: string }> = [];

  const diplomas = [
    { pattern: /master.*fle|m2.*fle|master 2.*fle/i, name: 'Master FLE (M2)' },
    { pattern: /master.*didactique.*langues|m2.*didactique/i, name: 'Master Didactique des Langues' },
    { pattern: /daefle/i, name: 'DAEFLE (Alliance Française)' },
    { pattern: /dufle/i, name: 'DUFLE' },
    { pattern: /licence.*fle|l3.*fle/i, name: 'Licence FLE' },
    { pattern: /du.*fle/i, name: 'DU FLE' }
  ];

  formations.forEach((formation, index) => {
    const intitule = formation.intitule || '';
    const etablissement = formation.etablissement || '';
    const combinedText = `${intitule} ${etablissement}`.toLowerCase();

    for (const diploma of diplomas) {
      if (diploma.pattern.test(combinedText)) {
        detected.push({
          diploma: diploma.name,
          quote: intitule || combinedText,
          field_path: `formations[${index}].intitule`
        });
        break; // Un seul diplôme par formation
      }
    }
  });

  return detected;
}

/**
 * Génère la version HTML du rapport d'évaluation
 */
export function generateHTMLReport(evaluation: EvaluationResult): string {
  const { overall_score_0_to_100, recommendation, subscores, relevance_summary, strengths, improvements, fails } = evaluation;

  let html = '<div class="evaluation-report">';

  // Header avec score
  html += `<div class="score-header">`;
  html += `<strong>Score : ${Math.round(overall_score_0_to_100)}/100</strong><br>`;
  html += `Recommandation : <strong>${recommendation}</strong>`;
  html += `</div>`;

  // Sous-scores
  html += `<div class="subscores">`;
  html += `<strong>Sous-scores :</strong>`;
  html += `<ul>`;
  html += `<li>Expérience pertinente : ${subscores.experience_years_relevant.toFixed(1)} ans</li>`;
  html += `<li>Compétences : ${subscores.skills_match_0_to_100}%</li>`;
  html += `<li>Nice-to-have : ${subscores.nice_to_have_0_to_100}%</li>`;
  html += `</ul>`;
  html += `</div>`;

  // Pertinence
  html += `<div class="relevance">`;
  html += `<strong>Pertinence :</strong>`;
  html += `<ul>`;
  html += `<li>${relevance_summary.months_direct} mois DIRECTE</li>`;
  html += `<li>${relevance_summary.months_adjacent} mois ADJACENTE</li>`;
  html += `</ul>`;
  html += `</div>`;

  // Points forts
  if (strengths.length > 0) {
    html += `<div class="strengths">`;
    html += `<strong>Points forts :</strong>`;
    html += `<ul>`;
    strengths.forEach(s => {
      html += `<li>${s.point}</li>`;
    });
    html += `</ul>`;
    html += `</div>`;
  }

  // Points d'amélioration
  if (improvements.length > 0) {
    html += `<div class="improvements">`;
    html += `<strong>Points d'amélioration :</strong>`;
    html += `<ul>`;
    improvements.forEach(i => {
      html += `<li>${i.point}</li>`;
    });
    html += `</ul>`;
    html += `</div>`;
  }

  // Règles non satisfaites
  if (fails.length > 0) {
    html += `<div class="failures">`;
    html += `<strong>⚠️ Règles non satisfaites :</strong>`;
    html += `<ul>`;
    fails.forEach(f => {
      html += `<li>${f.reason}</li>`;
    });
    html += `</ul>`;
    html += `</div>`;
  }

  html += '</div>';

  return html;
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
