/**
 * Test complet de l'orchestrateur avec API OpenAI réelle
 *
 * Ce test utilise la clé API OpenAI pour tester le pipeline complet:
 * 1. Extraction CV
 * 2. Validation
 * 3. Pré-filtre
 * 4. Compression tokens
 * 5. Analyse provider
 * 6. Évaluation needsMore
 * 7. Résultat agrégé
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { orchestrateAnalysis } from '../orchestrator';
import type { JobSpec } from '../types';

// Charger les variables d'environnement depuis .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('\n🧪 ORCHESTRATOR FULL PIPELINE TEST\n');
console.log('═══════════════════════════════════════════════\n');

async function runFullTest() {
  // Vérifier la clé API
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found in .env.local');
  }

  console.log('✅ OpenAI API key loaded\n');

  // =========================================================================
  // CV de test : Développeuse Full Stack Senior
  // =========================================================================

  const cvText = `
SOPHIE MARTIN
Développeuse Full Stack Senior
sophie.martin@example.com | +33 6 12 34 56 78 | Paris, France
LinkedIn: linkedin.com/in/sophiemartin | GitHub: github.com/sophiemartin

RÉSUMÉ
Développeuse Full Stack passionnée avec 6 ans d'expérience dans le développement d'applications web modernes.
Expertise en React, Node.js, TypeScript et architectures cloud. Spécialisée dans les applications SaaS à fort trafic.

EXPÉRIENCE PROFESSIONNELLE

Lead Developer Full Stack | TechCorp SAS | Paris
Janvier 2021 - Présent (4 ans)
• Architecture et développement d'une plateforme SaaS B2B utilisée par 50 000+ entreprises
• Stack technique : React 18, TypeScript, Node.js, PostgreSQL, Redis, AWS (EC2, S3, Lambda)
• Mise en place d'une architecture microservices avec Docker et Kubernetes
• Réduction du temps de chargement de 40% grâce à l'optimisation des requêtes et au cache distribué
• Mentorat d'une équipe de 4 développeurs juniors
• Mise en place de tests automatisés (Jest, Cypress) avec couverture de code >85%

Développeuse Full Stack | WebAgency Pro | Paris
Juin 2019 - Décembre 2020 (1.5 ans)
• Développement de sites e-commerce et applications web pour clients grands comptes
• Technologies : React, Vue.js, Node.js, Express, MongoDB
• Intégration de systèmes de paiement (Stripe, PayPal) et APIs tierces
• Optimisation SEO et performances (Google Lighthouse score >90)
• Participation aux sprints Agile et cérémonies Scrum

Développeuse Frontend | StartupLab | Paris
Septembre 2018 - Mai 2019 (9 mois)
• Développement d'interfaces utilisateur modernes avec React et Material-UI
• Intégration d'APIs REST et GraphQL
• Collaboration étroite avec les designers UX/UI
• Refonte complète du design system de l'entreprise

FORMATION

Master Informatique - Spécialité Génie Logiciel
Université Paris-Saclay | 2016 - 2018
Mention Bien

Licence Informatique
Université Paris-Sud | 2013 - 2016

COMPÉTENCES TECHNIQUES

Frontend : React, TypeScript, Next.js, Vue.js, HTML5, CSS3, Tailwind CSS, Redux
Backend : Node.js, Express, NestJS, Python, Django, Flask
Bases de données : PostgreSQL, MySQL, MongoDB, Redis
DevOps : Docker, Kubernetes, AWS, CI/CD (GitHub Actions, Jenkins), Terraform
Outils : Git, VSCode, Postman, Figma, Jira, Slack
Tests : Jest, React Testing Library, Cypress, Playwright

LANGUES

Français : Langue maternelle
Anglais : Courant (TOEIC 950/990)
Espagnol : Intermédiaire

CERTIFICATIONS

AWS Certified Developer - Associate (2023)
MongoDB Certified Developer (2022)

PROJETS PERSONNELS

OpenSource Contributor
• Contributrice active sur plusieurs projets React et Node.js (50+ PRs mergées)
• Mainteneuse d'une librairie de composants React avec 2000+ stars GitHub

Blog Tech
• Rédaction d'articles techniques sur le développement web moderne
• 10 000+ lecteurs mensuels
`;

  // =========================================================================
  // JobSpec : Poste Développeur Full Stack React/Node Senior
  // =========================================================================

  const jobSpec: JobSpec = {
    title: 'Développeur Full Stack React/Node Senior',
    must_have: [
      {
        id: 'M1',
        desc: 'Minimum 4 ans d\'expérience en développement web Full Stack',
        severity: 'critical',
      },
      {
        id: 'M2',
        desc: 'Maîtrise avancée de React et TypeScript',
        severity: 'critical',
      },
      {
        id: 'M3',
        desc: 'Expérience confirmée avec Node.js et APIs REST',
        severity: 'critical',
      },
      {
        id: 'M4',
        desc: 'Expérience avec PostgreSQL ou bases de données relationnelles',
        severity: 'standard',
      },
    ],
    skills_required: [
      'React',
      'TypeScript',
      'Node.js',
      'PostgreSQL',
      'Docker',
      'AWS',
      'Git',
    ],
    nice_to_have: [
      'Next.js',
      'Kubernetes',
      'Redis',
      'CI/CD',
      'Tests automatisés',
      'Architecture microservices',
      'Mentorat',
    ],
    relevance_rules: {
      direct: [
        'développeur',
        'développeuse',
        'dev',
        'software engineer',
        'full stack',
        'fullstack',
        'lead developer',
      ],
      adjacent: [
        'ingénieur logiciel',
        'tech lead',
        'architecte logiciel',
        'développeur backend',
        'développeur frontend',
      ],
      peripheral: [
        'développeur mobile',
        'devops',
        'data engineer',
        'analyste programmeur',
      ],
    },
    weights: {
      w_exp: 0.35,
      w_skills: 0.45,
      w_nice: 0.20,
      p_adjacent: 0.6,
    },
    thresholds: {
      years_full_score: 5,
      shortlist_min: 75,
      consider_min: 60,
    },
  };

  // =========================================================================
  // Test Mode ÉCO
  // =========================================================================

  console.log('\n📊 TEST 1: Mode ÉCO (Single Provider)\n');
  console.log('─────────────────────────────────────────────────\n');

  const resultEco = await orchestrateAnalysis(cvText, jobSpec, {
    mode: 'eco',
    enablePrefilter: false,
    enablePacking: true,
    analysisDate: '2025-01-24',
  });

  console.log('\n📈 RÉSULTATS MODE ÉCO:\n');
  console.log(`Recommendation: ${resultEco.final_decision.recommendation}`);
  console.log(`Score global: ${resultEco.final_decision.overall_score_0_to_100.toFixed(1)}/100`);
  console.log(`Must-have: ${resultEco.final_decision.meets_all_must_have ? '✅' : '❌'}`);
  console.log(`\nSous-scores:`);
  console.log(`  - Expérience: ${resultEco.final_decision.subscores.experience_years_relevant.toFixed(1)} ans pertinentes`);
  console.log(`  - Compétences: ${resultEco.final_decision.subscores.skills_match_0_to_100}/100`);
  console.log(`  - Nice-to-have: ${resultEco.final_decision.subscores.nice_to_have_0_to_100}/100`);
  console.log(`\nPerformance:`);
  console.log(`  - Temps total: ${resultEco.performance.total_execution_time_ms}ms`);
  console.log(`  - Extraction: ${resultEco.performance.extraction_time_ms}ms`);
  console.log(`  - Évaluation: ${resultEco.performance.evaluation_time_ms}ms`);
  console.log(`\nCoût:`);
  console.log(`  - Total: $${resultEco.cost.total_usd.toFixed(4)}`);
  console.log(`  - Extraction: $${resultEco.cost.by_stage.extraction.toFixed(4)}`);
  console.log(`  - Évaluation: $${resultEco.cost.by_stage.evaluation.toFixed(4)}`);

  // Afficher les forces principales
  if (resultEco.final_decision.strengths.length > 0) {
    console.log(`\n💪 Forces principales (${resultEco.final_decision.strengths.length}):`);
    resultEco.final_decision.strengths.slice(0, 3).forEach((strength, idx) => {
      console.log(`  ${idx + 1}. ${strength.category}: ${strength.point}`);
      if (strength.evidence.length > 0) {
        console.log(`     📄 "${strength.evidence[0].quote.substring(0, 80)}..."`);
      }
    });
  }

  // Afficher les échecs must-have
  if (resultEco.final_decision.fails.length > 0) {
    console.log(`\n❌ Must-have échoués (${resultEco.final_decision.fails.length}):`);
    resultEco.final_decision.fails.forEach((fail) => {
      console.log(`  - ${fail.rule_id}: ${fail.reason}`);
    });
  }

  // Afficher les expériences pertinentes
  console.log(`\n📋 Expériences pertinentes:`);
  const directExp = resultEco.final_decision.relevance_summary.by_experience.filter(
    (e) => e.relevance === 'DIRECTE'
  );
  const adjacentExp = resultEco.final_decision.relevance_summary.by_experience.filter(
    (e) => e.relevance === 'ADJACENTE'
  );

  console.log(`  - DIRECTE: ${directExp.length} (${resultEco.final_decision.relevance_summary.months_direct} mois)`);
  directExp.forEach((exp) => {
    console.log(`    • ${exp.titre} - ${exp.reason}`);
  });

  console.log(`  - ADJACENTE: ${adjacentExp.length} (${resultEco.final_decision.relevance_summary.months_adjacent} mois)`);
  adjacentExp.forEach((exp) => {
    console.log(`    • ${exp.titre} - ${exp.reason}`);
  });

  // =========================================================================
  // Test Mode BALANCED
  // =========================================================================

  console.log('\n\n📊 TEST 2: Mode BALANCED (Conditional Multi-Provider)\n');
  console.log('─────────────────────────────────────────────────\n');

  const resultBalanced = await orchestrateAnalysis(cvText, jobSpec, {
    mode: 'balanced',
    enablePrefilter: true,
    enablePacking: true,
    analysisDate: '2025-01-24',
    forceSingleProvider: true, // Pour ce test, on reste en single provider
  });

  console.log('\n📈 RÉSULTATS MODE BALANCED:\n');
  console.log(`Recommendation: ${resultBalanced.final_decision.recommendation}`);
  console.log(`Score global: ${resultBalanced.final_decision.overall_score_0_to_100.toFixed(1)}/100`);
  console.log(`Must-have: ${resultBalanced.final_decision.meets_all_must_have ? '✅' : '❌'}`);
  console.log(`\nPerformance:`);
  console.log(`  - Temps total: ${resultBalanced.performance.total_execution_time_ms}ms`);
  if (resultBalanced.performance.prefilter_time_ms) {
    console.log(`  - Pré-filtre: ${resultBalanced.performance.prefilter_time_ms}ms`);
  }
  console.log(`  - Extraction: ${resultBalanced.performance.extraction_time_ms}ms`);
  console.log(`  - Évaluation: ${resultBalanced.performance.evaluation_time_ms}ms`);
  console.log(`\nCoût:`);
  console.log(`  - Total: $${resultBalanced.cost.total_usd.toFixed(4)}`);

  // Afficher les triggers needsMore
  if (resultBalanced.debug.reasons_for_multi_provider) {
    console.log(`\n🔄 Triggers needsMore détectés:`);
    resultBalanced.debug.reasons_for_multi_provider.forEach((trigger) => {
      console.log(`  - ${trigger}`);
    });
  } else {
    console.log(`\n✅ Pas de triggers needsMore (confiance élevée du provider principal)`);
  }

  // =========================================================================
  // Validation des résultats
  // =========================================================================

  console.log('\n\n═══════════════════════════════════════════════');
  console.log('✅ VALIDATION DES RÉSULTATS');
  console.log('═══════════════════════════════════════════════\n');

  const validations = [
    {
      test: 'CV extrait et validé',
      pass: resultEco.final_decision.relevance_summary.by_experience.length > 0,
    },
    {
      test: 'Score global cohérent (0-100)',
      pass:
        resultEco.final_decision.overall_score_0_to_100 >= 0 &&
        resultEco.final_decision.overall_score_0_to_100 <= 100,
    },
    {
      test: 'Recommendation valide',
      pass: ['SHORTLIST', 'CONSIDER', 'REJECT'].includes(
        resultEco.final_decision.recommendation
      ),
    },
    {
      test: 'Must-have évalués',
      pass:
        typeof resultEco.final_decision.meets_all_must_have === 'boolean',
    },
    {
      test: 'Sous-scores présents',
      pass:
        resultEco.final_decision.subscores.experience_years_relevant >= 0 &&
        resultEco.final_decision.subscores.skills_match_0_to_100 >= 0 &&
        resultEco.final_decision.subscores.nice_to_have_0_to_100 >= 0,
    },
    {
      test: 'Forces identifiées',
      pass: resultEco.final_decision.strengths.length > 0,
    },
    {
      test: 'Preuves (evidence) présentes',
      pass: resultEco.final_decision.strengths.some((s) => s.evidence.length > 0),
    },
    {
      test: 'Expériences classifiées par pertinence',
      pass: resultEco.final_decision.relevance_summary.by_experience.every(
        (e) => ['DIRECTE', 'ADJACENTE', 'PERIPHERIQUE', 'NON_PERTINENTE'].includes(e.relevance)
      ),
    },
    {
      test: 'Temps d\'exécution raisonnable (< 60s)',
      pass: resultEco.performance.total_execution_time_ms < 60000,
    },
    {
      test: 'Coût calculé',
      pass: resultEco.cost.total_usd > 0,
    },
    {
      test: 'Consensus défini',
      pass:
        resultEco.consensus.level === 'strong' ||
        resultEco.consensus.level === 'moderate' ||
        resultEco.consensus.level === 'weak',
    },
    {
      test: 'Providers utilisés trackés',
      pass: resultEco.debug.providers_used.length > 0,
    },
  ];

  let passedCount = 0;
  validations.forEach((validation) => {
    const status = validation.pass ? '✅' : '❌';
    console.log(`${status} ${validation.test}`);
    if (validation.pass) passedCount++;
  });

  console.log(`\n📊 Résultat: ${passedCount}/${validations.length} validations passées`);

  if (passedCount === validations.length) {
    console.log('\n🎉 TOUS LES TESTS SONT PASSÉS !');
    console.log('\n✅ Le pipeline orchestrateur est opérationnel !');
  } else {
    console.log(`\n⚠️  ${validations.length - passedCount} validation(s) échouée(s)`);
    process.exit(1);
  }

  // =========================================================================
  // Résumé final
  // =========================================================================

  console.log('\n═══════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ DU TEST COMPLET');
  console.log('═══════════════════════════════════════════════\n');

  console.log('CV testé: Sophie Martin - Développeuse Full Stack Senior');
  console.log('Expérience: 6 ans en développement web');
  console.log('Stack: React, TypeScript, Node.js, PostgreSQL, AWS\n');

  console.log('Modes testés:');
  console.log('  1. ÉCO       → Single provider, pas de prefilter');
  console.log('  2. BALANCED  → Single provider + prefilter\n');

  console.log('Résultats:');
  console.log(`  - Recommendation: ${resultEco.final_decision.recommendation}`);
  console.log(`  - Score: ${resultEco.final_decision.overall_score_0_to_100.toFixed(1)}/100`);
  console.log(`  - Must-have: ${resultEco.final_decision.meets_all_must_have ? 'Tous respectés ✅' : 'Certains échoués ❌'}`);
  console.log(`  - Forces: ${resultEco.final_decision.strengths.length} identifiées`);
  console.log(`  - Coût mode ÉCO: $${resultEco.cost.total_usd.toFixed(4)}`);
  console.log(`  - Temps mode ÉCO: ${(resultEco.performance.total_execution_time_ms / 1000).toFixed(1)}s`);

  console.log('\n═══════════════════════════════════════════════\n');
}

// Exécuter le test
runFullTest().catch((error) => {
  console.error('\n❌ TEST FAILED:', error);
  console.error('\nStack trace:', error.stack);
  process.exit(1);
});
