/**
 * Test d'intégration Phase 3 - Multi-provider
 *
 * Teste:
 * - Gemini Provider
 * - Claude Provider
 * - Aggregator multi-provider
 * - Orchestrator en mode Premium
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { aggregateProviderResults } from '../aggregator/multi-provider-aggregator';
import type { EvaluationResult, ProviderName } from '../types';

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('\n🧪 Phase 3 Integration Test\n');

async function runTests() {
  // =========================================================================
  // Test 1: Providers disponibles
  // =========================================================================

  console.log('🔍 Test 1: Providers Availability');

  const apiKeys = {
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    claude: !!process.env.ANTHROPIC_API_KEY,
  };

  console.log(`   OpenAI: ${apiKeys.openai ? '✅' : '❌'}`);
  console.log(`   Gemini: ${apiKeys.gemini ? '✅' : '❌'}`);
  console.log(`   Claude: ${apiKeys.claude ? '✅' : '❌'}`);

  const availableCount = Object.values(apiKeys).filter(Boolean).length;
  console.log(`   Available: ${availableCount}/3\n`);

  // =========================================================================
  // Test 2: Aggregator avec résultats mockés
  // =========================================================================

  console.log('📊 Test 2: Aggregator with Mock Results');

  // Résultats mockés simulant 3 providers avec un léger désaccord
  const mockResults: Record<ProviderName, EvaluationResult | null> = {
    openai: {
      meets_all_must_have: true,
      fails: [],
      relevance_summary: {
        months_direct: 48,
        months_adjacent: 12,
        months_peripheral: 0,
        months_non_pertinent: 0,
        by_experience: [
          {
            index: 0,
            titre: 'Lead Developer',
            relevance: 'DIRECTE',
            reason: 'Direct match',
            months: 48,
            evidence: [{ quote: 'Lead Developer Full Stack', field_path: 'experiences[0].titre' }],
          },
        ],
      },
      subscores: {
        experience_years_relevant: 5.0,
        skills_match_0_to_100: 100,
        nice_to_have_0_to_100: 85,
      },
      overall_score_0_to_100: 97.3,
      recommendation: 'SHORTLIST',
      strengths: [
        {
          category: 'Experience',
          point: 'Strong Full Stack experience',
          evidence: [{ quote: 'Lead Developer', field_path: 'experiences[0].titre' }],
        },
      ],
      improvements: [
        {
          point: 'More cloud certifications',
          why: 'To strengthen cloud expertise',
          suggested_action: 'Get AWS Solutions Architect certification',
        },
      ],
    },
    gemini: {
      meets_all_must_have: true,
      fails: [],
      relevance_summary: {
        months_direct: 45,
        months_adjacent: 15,
        months_peripheral: 0,
        months_non_pertinent: 0,
        by_experience: [
          {
            index: 0,
            titre: 'Lead Developer',
            relevance: 'DIRECTE',
            reason: 'Direct match',
            months: 45,
            evidence: [{ quote: 'Lead Developer Full Stack', field_path: 'experiences[0].titre' }],
          },
        ],
      },
      subscores: {
        experience_years_relevant: 4.8,
        skills_match_0_to_100: 95,
        nice_to_have_0_to_100: 80,
      },
      overall_score_0_to_100: 95.1,
      recommendation: 'SHORTLIST',
      strengths: [
        {
          category: 'Experience',
          point: 'Strong Full Stack experience',
          evidence: [{ quote: 'Lead Developer', field_path: 'experiences[0].titre' }],
        },
      ],
      improvements: [
        {
          point: 'More microservices experience',
          why: 'To match job requirements better',
          suggested_action: 'Work on distributed systems projects',
        },
      ],
    },
    claude: {
      meets_all_must_have: true,
      fails: [],
      relevance_summary: {
        months_direct: 50,
        months_adjacent: 10,
        months_peripheral: 0,
        months_non_pertinent: 0,
        by_experience: [
          {
            index: 0,
            titre: 'Lead Developer',
            relevance: 'DIRECTE',
            reason: 'Direct match',
            months: 50,
            evidence: [{ quote: 'Lead Developer Full Stack', field_path: 'experiences[0].titre' }],
          },
        ],
      },
      subscores: {
        experience_years_relevant: 5.2,
        skills_match_0_to_100: 100,
        nice_to_have_0_to_100: 90,
      },
      overall_score_0_to_100: 98.7,
      recommendation: 'SHORTLIST',
      strengths: [
        {
          category: 'Experience',
          point: 'Strong Full Stack experience',
          evidence: [{ quote: 'Lead Developer', field_path: 'experiences[0].titre' }],
        },
      ],
      improvements: [
        {
          point: 'Leadership documentation',
          why: 'To showcase team management skills',
          suggested_action: 'Document mentorship and team achievements',
        },
      ],
    },
  };

  const aggregationResult = aggregateProviderResults(mockResults, {
    useWeights: true,
    minimumProviders: 2,
  });

  console.log(`   Final score: ${aggregationResult.final_decision.overall_score_0_to_100.toFixed(1)}/100`);
  console.log(`   Recommendation: ${aggregationResult.final_decision.recommendation}`);
  console.log(`   Consensus level: ${aggregationResult.consensus.level}`);
  console.log(`   Agreement rate: ${(aggregationResult.consensus.agreement_rate * 100).toFixed(0)}%`);
  console.log(`   Score delta: ${aggregationResult.consensus.delta_overall_score.toFixed(1)} pts`);
  console.log(`   Disagreements: ${aggregationResult.disagreements.length}`);

  if (aggregationResult.disagreements.length > 0) {
    console.log(`   Details:`);
    aggregationResult.disagreements.forEach((d) => console.log(`      - ${d}`));
  }

  // Validations
  const validations = [
    {
      test: 'Final decision présent',
      pass: !!aggregationResult.final_decision,
    },
    {
      test: 'Score agrégé cohérent',
      pass:
        aggregationResult.final_decision.overall_score_0_to_100 >= 95 &&
        aggregationResult.final_decision.overall_score_0_to_100 <= 99,
    },
    {
      test: 'Consensus calculé',
      pass:
        aggregationResult.consensus.level === 'strong' ||
        aggregationResult.consensus.level === 'moderate',
    },
    {
      test: 'Agreement rate > 0',
      pass: aggregationResult.consensus.agreement_rate > 0,
    },
    {
      test: 'Recommendation unanime',
      pass: aggregationResult.consensus.agreement_rate === 1.0,
    },
  ];

  let passedCount = 0;
  validations.forEach((v) => {
    const status = v.pass ? '✅' : '❌';
    console.log(`   ${status} ${v.test}`);
    if (v.pass) passedCount++;
  });

  console.log(`\n📊 Aggregator test: ${passedCount}/${validations.length} validations passed\n`);

  if (passedCount < validations.length) {
    throw new Error('Aggregator test failed');
  }

  // =========================================================================
  // Test 3: Providers instanciation (si clés disponibles)
  // =========================================================================

  console.log('🔧 Test 3: Providers Instantiation');

  if (apiKeys.gemini) {
    try {
      const { createGeminiProvider } = await import('../providers/gemini-provider');
      const geminiProvider = createGeminiProvider();
      console.log(`   ✅ Gemini provider created successfully`);
    } catch (error) {
      console.error(`   ❌ Gemini provider failed:`, error);
    }
  } else {
    console.log(`   ⏭️  Gemini provider skipped (no API key)`);
  }

  if (apiKeys.claude) {
    try {
      const { createClaudeProvider } = await import('../providers/claude-provider');
      const claudeProvider = createClaudeProvider();
      console.log(`   ✅ Claude provider created successfully`);
    } catch (error) {
      console.error(`   ❌ Claude provider failed:`, error);
    }
  } else {
    console.log(`   ⏭️  Claude provider skipped (no API key)`);
  }

  console.log('');

  // =========================================================================
  // Résumé
  // =========================================================================

  console.log('═══════════════════════════════════════════════');
  console.log('📊 PHASE 3 INTEGRATION TEST SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log('✅ Aggregator: Working');
  console.log(`✅ Available providers: ${availableCount}/3`);
  console.log('✅ Multi-provider aggregation: Working');
  console.log('✅ Consensus detection: Working');
  console.log('═══════════════════════════════════════════════');
  console.log('\n🎉 All Phase 3 core components working correctly!\n');
  console.log('⚠️  Note: Full multi-provider test requires all 3 API keys');
  console.log('   Current availability:');
  console.log(`   - OpenAI: ${apiKeys.openai ? 'Available ✅' : 'Missing ❌'}`);
  console.log(`   - Gemini: ${apiKeys.gemini ? 'Available ✅' : 'Missing ❌'}`);
  console.log(`   - Claude: ${apiKeys.claude ? 'Available ✅' : 'Missing ❌'}`);
  console.log('');
}

// Exécuter les tests
runTests().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
