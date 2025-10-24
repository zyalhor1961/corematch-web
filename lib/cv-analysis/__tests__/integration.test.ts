/**
 * Tests d'intégration - Scénario complet réaliste
 */

import { initValidators, validateCVData, validateEvaluationResult } from '../validators';
import {
  calculateMonths,
  calculateTotalMonths,
  formatDuration,
} from '../utils/dates';
import {
  normalizeSkill,
  findMatchingSkills,
  extractKeywords,
} from '../utils/normalize';
import {
  detectDomain,
  mergeConfig,
} from '../config';

console.log('\n🧪 Integration Test - Scénario complet réaliste\n');

// ============================================================================
// Initialisation
// ============================================================================
console.log('🔧 Initializing validators...');
initValidators();
console.log('✅ Validators ready\n');

// ============================================================================
// Scénario: Analyser le CV d'un développeur Full Stack
// ============================================================================
console.log('📋 Scénario: Développeur Full Stack postule pour un poste React/Node\n');

// Étape 1: CV extrait
const cv = {
  identite: {
    prenom: 'Marie',
    nom: 'Dubois',
    email: 'marie.dubois@example.com',
  },
  experiences: [
    {
      index: 0,
      titre: 'Développeuse Full Stack',
      employeur: 'TechStartup SAS',
      date_debut: '2021-03',
      date_fin: 'en cours',
      missions: [
        'Développement d\'applications React.js',
        'Création d\'APIs REST avec Node.js et Express',
        'Gestion base de données PostgreSQL',
      ],
    },
    {
      index: 1,
      titre: 'Développeuse Frontend',
      employeur: 'WebAgency',
      date_debut: '2019-06',
      date_fin: '2021-02',
      missions: [
        'Intégration de maquettes avec HTML/CSS/JavaScript',
        'Développement composants Vue.js',
      ],
    },
  ],
  formations: [
    {
      index: 0,
      intitule: 'Master Informatique',
      etablissement: 'Université Lyon',
      annee: '2019',
      niveau: 'Bac+5',
    },
  ],
  competences: ['React.js', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'Git'],
  langues: [
    { langue: 'Français', niveau: 'Natif' },
    { langue: 'Anglais', niveau: 'Professionnel' },
  ],
};

console.log('✅ Step 1: CV structuré créé');

// Validation du CV
const cvValidation = validateCVData(cv);
if (!cvValidation.valid) {
  throw new Error(`CV validation failed: ${cvValidation.errorMessage}`);
}
console.log('✅ Step 2: CV validé par AJV');

// Étape 2: Détection du domaine métier
const domain = detectDomain('Développeur Full Stack React/Node');
console.log(`✅ Step 3: Domaine détecté = "${domain}"`);

// Récupération de la config domaine
const { weights, thresholds } = mergeConfig(domain);
console.log(`✅ Step 4: Config domaine appliquée (w_skills = ${weights.w_skills})`);

// Étape 3: Calcul des périodes d'expérience
const exp1Months = calculateMonths('2021-03', null, '2025-01-24');
const exp2Months = calculateMonths('2019-06', '2021-02', '2025-01-24');
const totalMonths = calculateTotalMonths(
  [
    { start: '2021-03', end: null },
    { start: '2019-06', end: '2021-02' },
  ],
  '2025-01-24'
);

console.log(`✅ Step 5: Expérience calculée:`);
console.log(`   - Exp 1 (TechStartup): ${formatDuration(exp1Months)}`);
console.log(`   - Exp 2 (WebAgency): ${formatDuration(exp2Months)}`);
console.log(`   - Total: ${formatDuration(totalMonths)}`);

// Étape 4: Matching des compétences
const requiredSkills = ['React', 'Node.js', 'JavaScript', 'MongoDB'];
const { matched, missing } = findMatchingSkills(cv.competences, requiredSkills);

console.log(`✅ Step 6: Compétences analysées:`);
console.log(`   - Matched: ${matched.join(', ')}`);
console.log(`   - Missing: ${missing.join(', ')}`);

// Étape 5: Extraction de mots-clés des missions
const allMissions = cv.experiences.flatMap((exp) => exp.missions || []).join(' ');
const keywords = extractKeywords(allMissions, 4);
console.log(`✅ Step 7: Mots-clés extraits: ${keywords.slice(0, 10).join(', ')}...`);

// Étape 6: Simulation d'un résultat d'évaluation
const experienceYears = totalMonths / 12;
const skillsMatchPercent = Math.round((matched.length / requiredSkills.length) * 100);

const scoreExp = Math.min(1, experienceYears / thresholds.years_full_score);
const scoreSkills = skillsMatchPercent / 100;
const scoreNice = 0.6; // Simulé

const overallScore =
  100 * (weights.w_exp * scoreExp + weights.w_skills * scoreSkills + weights.w_nice * scoreNice);

console.log(`\n✅ Step 8: Scoring calculé:`);
console.log(`   - Experience: ${experienceYears.toFixed(1)} ans → score ${(scoreExp * 100).toFixed(0)}%`);
console.log(`   - Skills: ${skillsMatchPercent}% matched → score ${(scoreSkills * 100).toFixed(0)}%`);
console.log(`   - Nice-to-have: 60% (simulé)`);
console.log(`   - Overall: ${overallScore.toFixed(1)}/100`);

let recommendation: 'SHORTLIST' | 'CONSIDER' | 'REJECT';
if (overallScore >= thresholds.shortlist_min) {
  recommendation = 'SHORTLIST';
} else if (overallScore >= thresholds.consider_min) {
  recommendation = 'CONSIDER';
} else {
  recommendation = 'REJECT';
}

console.log(`   - Recommandation: ${recommendation}`);

// Étape 7: Validation du résultat d'évaluation
const evaluationResult = {
  meets_all_must_have: true,
  fails: [],
  relevance_summary: {
    months_direct: totalMonths,
    months_adjacent: 0,
    months_peripheral: 0,
    months_non_pertinent: 0,
    by_experience: cv.experiences.map((exp) => ({
      index: exp.index,
      titre: exp.titre,
      employeur: exp.employeur || '',
      start: exp.date_debut,
      end: exp.date_fin === 'en cours' ? null : exp.date_fin,
      relevance: 'DIRECTE' as const,
      reason: 'Développement web Full Stack',
      evidence: [
        {
          quote: exp.missions?.[0] || '',
          field_path: `experiences[${exp.index}].missions[0]`,
        },
      ],
    })),
  },
  subscores: {
    experience_years_relevant: experienceYears,
    skills_match_0_to_100: skillsMatchPercent,
    nice_to_have_0_to_100: 60,
  },
  overall_score_0_to_100: overallScore,
  recommendation,
  strengths: [
    {
      point: `Solide expérience en développement web (${formatDuration(totalMonths)})`,
      evidence: [
        {
          quote: 'Développement d\'applications React.js',
          field_path: 'experiences[0].missions[0]',
        },
      ],
    },
    {
      point: 'Maîtrise de la stack React/Node',
      evidence: [
        {
          quote: 'React.js, Node.js',
          field_path: 'competences',
        },
      ],
    },
  ],
  improvements: [
    {
      point: 'MongoDB non maîtrisé',
      why: 'Compétence requise absente du CV',
      suggested_action: 'Se former à MongoDB ou documenter expérience équivalente (PostgreSQL)',
    },
  ],
};

const evalValidation = validateEvaluationResult(evaluationResult);
if (!evalValidation.valid) {
  throw new Error(`Evaluation validation failed: ${evalValidation.errorMessage}`);
}

console.log('\n✅ Step 9: Résultat d\'évaluation validé par AJV');

// ============================================================================
// Résumé
// ============================================================================
console.log('\n📊 RÉSUMÉ DU SCÉNARIO');
console.log('═══════════════════════════════════════════════════════');
console.log(`Candidat: ${cv.identite.prenom} ${cv.identite.nom}`);
console.log(`Domaine: ${domain}`);
console.log(`Expérience: ${formatDuration(totalMonths)}`);
console.log(`Compétences: ${matched.length}/${requiredSkills.length} matched`);
console.log(`Score: ${overallScore.toFixed(1)}/100`);
console.log(`Recommandation: ${recommendation}`);
console.log('═══════════════════════════════════════════════════════');

console.log('\n✅ Integration test passed!\n');
