/**
 * Test complet multi-provider avec CV réel
 *
 * Compare les 3 modes:
 * - ÉCO: Single provider (OpenAI)
 * - BALANCED: Conditional multi-provider (OpenAI + Gemini si needsMore)
 * - PREMIUM: Full multi-provider (OpenAI + Gemini + Claude)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { orchestrateAnalysis } from '../orchestrator';
import type { JobSpec, AggregatedResult } from '../types';

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('\n🧪 MULTI-PROVIDER REAL TEST - 3 Modes Comparison\n');
console.log('═══════════════════════════════════════════════\n');

async function runRealTest() {
  // Vérifier les clés API disponibles
  const apiKeys = {
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    claude: !!process.env.ANTHROPIC_API_KEY,
  };

  console.log('📋 API Keys Status:');
  console.log(`   OpenAI: ${apiKeys.openai ? '✅ Available' : '❌ Missing'}`);
  console.log(`   Gemini: ${apiKeys.gemini ? '✅ Available' : '❌ Missing'}`);
  console.log(`   Claude: ${apiKeys.claude ? '✅ Available' : '❌ Missing'}`);
  console.log('');

  if (!apiKeys.openai) {
    throw new Error('OPENAI_API_KEY is required');
  }

  // =========================================================================
  // CV de test : Développeuse Full Stack Senior (Sophie Martin)
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
  // COMPARAISON DES 3 MODES
  // =========================================================================

  const results: Record<string, AggregatedResult> = {};

  // -------------------------------------------------------------------------
  // Mode 1: ÉCO (Single Provider)
  // -------------------------------------------------------------------------

  console.log('🔵 TEST 1: Mode ÉCO (Single Provider)\n');
  console.log('─────────────────────────────────────────────────\n');

  const startEco = Date.now();
  results.eco = await orchestrateAnalysis(cvText, jobSpec, {
    mode: 'eco',
    enablePrefilter: false,
    enablePacking: true,
  });
  const timeEco = Date.now() - startEco;

  console.log('\n📊 RÉSULTATS MODE ÉCO:');
  console.log(`   Score: ${results.eco.final_decision.overall_score_0_to_100.toFixed(1)}/100`);
  console.log(`   Recommendation: ${results.eco.final_decision.recommendation}`);
  console.log(`   Providers: ${results.eco.debug.providers_used.join(', ')}`);
  console.log(`   Consensus: ${results.eco.consensus.level}`);
  console.log(`   Temps: ${(timeEco / 1000).toFixed(1)}s`);
  console.log(`   Coût: $${results.eco.cost.total_usd.toFixed(4)}\n`);

  // -------------------------------------------------------------------------
  // Mode 2: BALANCED (Conditional Multi-Provider)
  // -------------------------------------------------------------------------

  if (apiKeys.gemini) {
    console.log('🟢 TEST 2: Mode BALANCED (Conditional Multi-Provider)\n');
    console.log('─────────────────────────────────────────────────\n');

    const startBalanced = Date.now();
    results.balanced = await orchestrateAnalysis(cvText, jobSpec, {
      mode: 'balanced',
      enablePrefilter: true,
      enablePacking: true,
      forceSingleProvider: false, // Permettre multi-provider si needsMore
    });
    const timeBalanced = Date.now() - startBalanced;

    console.log('\n📊 RÉSULTATS MODE BALANCED:');
    console.log(`   Score: ${results.balanced.final_decision.overall_score_0_to_100.toFixed(1)}/100`);
    console.log(`   Recommendation: ${results.balanced.final_decision.recommendation}`);
    console.log(`   Providers: ${results.balanced.debug.providers_used.join(', ')}`);
    console.log(`   Aggregation: ${results.balanced.debug.aggregation_method}`);
    console.log(`   Consensus: ${results.balanced.consensus.level}`);

    if (results.balanced.consensus.disagreements_count > 0) {
      console.log(`   Disagreements: ${results.balanced.consensus.disagreements_count}`);
      console.log(`   Details: ${results.balanced.debug.model_disagreements.join('; ')}`);
    }

    console.log(`   Temps: ${(timeBalanced / 1000).toFixed(1)}s`);
    console.log(`   Coût: $${results.balanced.cost.total_usd.toFixed(4)}\n`);
  } else {
    console.log('⏭️  TEST 2: Mode BALANCED skipped (GEMINI_API_KEY missing)\n');
  }

  // -------------------------------------------------------------------------
  // Mode 3: PREMIUM (Full Multi-Provider)
  // -------------------------------------------------------------------------

  if (apiKeys.gemini) {
    console.log('🟣 TEST 3: Mode PREMIUM (Full Multi-Provider)\n');
    console.log('─────────────────────────────────────────────────\n');

    const startPremium = Date.now();
    results.premium = await orchestrateAnalysis(cvText, jobSpec, {
      mode: 'premium',
      enablePrefilter: true,
      enablePacking: true,
      forceSingleProvider: false,
    });
    const timePremium = Date.now() - startPremium;

    console.log('\n📊 RÉSULTATS MODE PREMIUM:');
    console.log(`   Score: ${results.premium.final_decision.overall_score_0_to_100.toFixed(1)}/100`);
    console.log(`   Recommendation: ${results.premium.final_decision.recommendation}`);
    console.log(`   Providers: ${results.premium.debug.providers_used.join(', ')}`);
    console.log(`   Aggregation: ${results.premium.debug.aggregation_method}`);
    console.log(`   Consensus: ${results.premium.consensus.level}`);
    console.log(`   Agreement rate: ${(results.premium.consensus.agreement_rate * 100).toFixed(0)}%`);
    console.log(`   Score delta: ${results.premium.consensus.delta_overall_score.toFixed(1)} pts`);

    if (results.premium.debug.model_disagreements.length > 0) {
      console.log(`   Disagreements:`);
      results.premium.debug.model_disagreements.forEach((d) => console.log(`      - ${d}`));
    }

    if (results.premium.arbiter) {
      console.log(`   Arbiter: ${results.premium.arbiter.justification}`);
    }

    console.log(`   Temps: ${(timePremium / 1000).toFixed(1)}s`);
    console.log(`   Coût: $${results.premium.cost.total_usd.toFixed(4)}`);

    // Afficher les scores individuels des providers
    console.log(`\n   Scores individuels:`);
    Object.entries(results.premium.providers_raw).forEach(([provider, result]) => {
      if (result) {
        console.log(`      - ${provider}: ${result.overall_score_0_to_100.toFixed(1)}/100`);
      }
    });

    console.log('');
  } else {
    console.log('⏭️  TEST 3: Mode PREMIUM skipped (GEMINI_API_KEY missing)\n');
  }

  // =========================================================================
  // COMPARAISON FINALE
  // =========================================================================

  console.log('\n═══════════════════════════════════════════════');
  console.log('📊 COMPARAISON DES MODES');
  console.log('═══════════════════════════════════════════════\n');

  const comparison = [
    {
      mode: 'ÉCO',
      result: results.eco,
    },
    results.balanced && {
      mode: 'BALANCED',
      result: results.balanced,
    },
    results.premium && {
      mode: 'PREMIUM',
      result: results.premium,
    },
  ].filter(Boolean);

  console.log('Mode       | Score  | Recommendation | Providers | Consensus | Temps | Coût');
  console.log('-----------|--------|----------------|-----------|-----------|-------|-------');

  comparison.forEach((c: any) => {
    const mode = c.mode.padEnd(10);
    const score = c.result.final_decision.overall_score_0_to_100.toFixed(1).padStart(6);
    const rec = c.result.final_decision.recommendation.padEnd(14);
    const providers = c.result.debug.providers_used.length.toString().padStart(9);
    const consensus = c.result.consensus.level.padEnd(9);
    const time = `${(c.result.performance.total_execution_time_ms / 1000).toFixed(1)}s`.padStart(5);
    const cost = `$${c.result.cost.total_usd.toFixed(4)}`;

    console.log(`${mode} | ${score} | ${rec} | ${providers} | ${consensus} | ${time} | ${cost}`);
  });

  console.log('');

  // =========================================================================
  // ANALYSE DES RÉSULTATS
  // =========================================================================

  console.log('═══════════════════════════════════════════════');
  console.log('🔍 ANALYSE DES RÉSULTATS');
  console.log('═══════════════════════════════════════════════\n');

  // Cohérence des scores
  const scores = comparison.map((c: any) => c.result.final_decision.overall_score_0_to_100);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxDelta = Math.max(...scores) - Math.min(...scores);

  console.log('📈 Cohérence des scores:');
  console.log(`   Score moyen: ${avgScore.toFixed(1)}/100`);
  console.log(`   Écart max: ${maxDelta.toFixed(1)} pts`);
  console.log(`   Cohérence: ${maxDelta < 5 ? '✅ Excellente' : maxDelta < 10 ? '✅ Bonne' : '⚠️ Modérée'}\n`);

  // Recommandations
  const recommendations = comparison.map((c: any) => c.result.final_decision.recommendation);
  const uniqueRecs = new Set(recommendations);

  console.log('📋 Recommandations:');
  console.log(`   Accord: ${uniqueRecs.size === 1 ? '✅ Unanime' : '⚠️ Divergent'}`);
  recommendations.forEach((rec, idx) => {
    console.log(`   ${comparison[idx].mode}: ${rec}`);
  });
  console.log('');

  // Rapport coût/performance
  if (results.balanced && results.premium) {
    const costIncrease = ((results.premium.cost.total_usd - results.eco.cost.total_usd) / results.eco.cost.total_usd) * 100;
    const scoreIncrease = results.premium.final_decision.overall_score_0_to_100 - results.eco.final_decision.overall_score_0_to_100;

    console.log('💰 Analyse coût/bénéfice (PREMIUM vs ÉCO):');
    console.log(`   Surcoût: +${costIncrease.toFixed(0)}%`);
    console.log(`   Gain précision: ${scoreIncrease > 0 ? '+' : ''}${scoreIncrease.toFixed(1)} pts`);
    console.log(`   ROI: ${scoreIncrease > 2 ? '✅ Justifié' : '⚠️ Marginal'}\n`);
  }

  console.log('═══════════════════════════════════════════════');
  console.log('✅ MULTI-PROVIDER TEST COMPLETED');
  console.log('═══════════════════════════════════════════════\n');

  console.log('🎯 Recommandation:');
  if (maxDelta < 5 && uniqueRecs.size === 1) {
    console.log('   → Mode ÉCO ou BALANCED recommandé (résultats très cohérents)');
  } else if (maxDelta < 10) {
    console.log('   → Mode BALANCED recommandé (bon compromis coût/qualité)');
  } else {
    console.log('   → Mode PREMIUM recommandé (divergences significatives)');
  }
  console.log('');
}

// Exécuter le test
runRealTest().catch((error) => {
  console.error('\n❌ TEST FAILED:', error);
  console.error('\nStack trace:', error.stack);
  process.exit(1);
});
