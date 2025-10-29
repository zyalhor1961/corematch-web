/**
 * Tests d'Isolation du Cache par Job
 *
 * OBJECTIF: Garantir qu'un CV analysé pour Job A ne soit JAMAIS
 * réutilisé pour Job B (prévention "fuites de poste")
 *
 * Tests critiques:
 * 1. Même CV + Jobs différents => Clés de cache différentes
 * 2. Hash stable (même objet => même hash)
 * 3. Cache hit/miss fonctionnel
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  generateCacheKey,
  hashCV,
  hashJobSpec,
  hashObject,
  areJobSpecsEqual,
  areCVsEqual,
  parseCacheKey,
} from '@/lib/mcp/cache/cache-key';
import { InMemoryCacheStore, resetCacheStore } from '@/lib/mcp/cache/cache-store';
import type { CV_JSON, JobSpec, AggregatedResult } from '@/lib/cv-analysis/types';

// ============================================================================
// FIXTURES - CVs de test
// ============================================================================

const cvTeacher: CV_JSON = {
  identite: {
    prenom: 'Marie',
    nom: 'Dupont',
    email: 'marie.dupont@example.com',
    linkedin: 'linkedin.com/in/marie-dupont',
  },
  experiences: [
    {
      index: 0,
      titre: 'Professeure de FLE',
      employeur: 'Alliance Française Paris',
      date_debut: '2020-09',
      date_fin: null,
      missions: [
        'Enseignement du français langue étrangère à des adultes',
        'Préparation examens DELF/DALF',
        'Animation ateliers conversation',
      ],
    },
    {
      index: 1,
      titre: 'Formatrice FLE',
      employeur: 'Institut Français',
      date_debut: '2018-01',
      date_fin: '2020-08',
      missions: ['Cours de français pour débutants', 'Création de supports pédagogiques'],
    },
  ],
  formations: [
    {
      index: 0,
      intitule: 'Master FLE',
      etablissement: 'Université Paris 3 Sorbonne Nouvelle',
      annee: '2017',
    },
  ],
  competences: ['Enseignement FLE', 'Pédagogie', 'DELF/DALF', 'Animation de groupes'],
  langues: [
    { langue: 'Français', niveau: 'Natif' },
    { langue: 'Anglais', niveau: 'C1' },
  ],
  certifications: [{ nom: 'Habilitation DELF/DALF', organisme: 'France Éducation International' }],
};

const cvPainter: CV_JSON = {
  identite: {
    prenom: 'Jean',
    nom: 'Martin',
    email: 'jean.martin@example.com',
  },
  experiences: [
    {
      index: 0,
      titre: 'Peintre BTP',
      employeur: 'Entreprise Dupuis',
      date_debut: '2015-03',
      date_fin: null,
      missions: ['Peinture intérieure et extérieure', 'Ravalement de façades', 'Travaux de finition'],
    },
  ],
  formations: [
    {
      index: 0,
      intitule: 'CAP Peintre',
      etablissement: 'CFA du Bâtiment',
      annee: '2014',
    },
  ],
  competences: ['Peinture', 'Ravalement', 'Échafaudage', 'Finitions'],
  langues: [{ langue: 'Français', niveau: 'Natif' }],
};

// ============================================================================
// FIXTURES - JobSpecs de test
// ============================================================================

const jobFLE: JobSpec = {
  title: 'Professeur(e) de FLE',
  must_have: [
    { id: 'FLE_DIPLOMA', desc: 'Diplôme FLE (Master ou équivalent)', severity: 'critical' },
    { id: 'EXPERIENCE_FLE', desc: 'Au moins 2 ans d\'expérience en enseignement FLE', severity: 'standard' },
  ],
  skills_required: ['Enseignement FLE', 'Pédagogie', 'DELF/DALF'],
  nice_to_have: ['Animation de groupes', 'Création de supports pédagogiques'],
  relevance_rules: {
    direct: ['fle', 'français langue étrangère', 'professeur', 'enseignant', 'formateur'],
    adjacent: ['enseignement', 'formation', 'pédagogie'],
    peripheral: ['animation', 'communication'],
  },
  weights: {
    w_exp: 0.5,
    w_skills: 0.3,
    w_nice: 0.2,
    p_adjacent: 0.5,
  },
  thresholds: {
    years_full_score: 3,
    shortlist_min: 75,
    consider_min: 60,
  },
};

const jobPainter: JobSpec = {
  title: 'Peintre BTP',
  must_have: [
    { id: 'DIPLOMA_PAINTER', desc: 'CAP/BEP Peinture', severity: 'standard' },
    { id: 'EXPERIENCE_BTP', desc: 'Expérience en peinture bâtiment', severity: 'critical' },
  ],
  skills_required: ['Peinture', 'Ravalement', 'Travaux de finition'],
  nice_to_have: ['Échafaudage', 'Permis B'],
  relevance_rules: {
    direct: ['peintre', 'peinture', 'btp', 'bâtiment', 'ravalement'],
    adjacent: ['finitions', 'plâtrerie', 'maçonnerie'],
    peripheral: ['chantier', 'construction'],
  },
  weights: {
    w_exp: 0.6,
    w_skills: 0.3,
    w_nice: 0.1,
    p_adjacent: 0.4,
  },
  thresholds: {
    years_full_score: 5,
    shortlist_min: 70,
    consider_min: 50,
  },
};

// ============================================================================
// Mock AggregatedResult
// ============================================================================

function createMockResult(score: number): AggregatedResult {
  return {
    final_decision: {
      meets_all_must_have: score >= 75,
      fails: [],
      relevance_summary: {
        months_direct: 36,
        months_adjacent: 12,
        months_peripheral: 0,
        months_non_pertinent: 0,
        by_experience: [],
      },
      subscores: {
        experience_years_relevant: score / 100,
        skills_match_0_to_100: score,
        nice_to_have_0_to_100: score * 0.8,
      },
      overall_score_0_to_100: score,
      recommendation: score >= 75 ? 'SHORTLIST' : score >= 60 ? 'CONSIDER' : 'REJECT',
      strengths: [],
      improvements: [],
    },
    providers_raw: {
      openai: null,
      gemini: null,
      claude: null,
    },
    consensus: {
      level: 'strong',
      delta_overall_score: 0,
      delta_subscores: { experience: 0, skills: 0, nice_to_have: 0 },
      agreement_rate: 1.0,
      disagreements_count: 0,
    },
    debug: {
      mode: 'balanced',
      providers_used: ['openai'],
      aggregation_method: 'single_provider',
      model_disagreements: [],
      early_exit: false,
    },
    performance: {
      total_execution_time_ms: 5000,
      extraction_time_ms: 1000,
      evaluation_time_ms: 4000,
    },
    cost: {
      total_usd: 0.25,
      by_provider: { openai: 0.25, gemini: 0, claude: 0 },
      by_stage: { extraction: 0.002, evaluation: 0.248 },
    },
    context_snapshot: {
      engine: 'corematch-mcp',
      engine_version: '2.0.0',
      sessionId: 'test-session',
      requestId: 'test-request',
      projectId: 'test-project',
      job_title: 'Test Job',
      jobSpecHash: 'test-hash',
      providers_called: [],
      mode: 'balanced',
      prefilter_enabled: true,
      packing_enabled: true,
      consensus_level: 'strong',
      arbiter_used: false,
      cost_total_usd: 0.25,
      cost_currency: 'USD',
      duration_total_ms: 5000,
      duration_extraction_ms: 1000,
      duration_evaluation_ms: 4000,
      analysis_started_at: new Date().toISOString(),
      analysis_completed_at: new Date().toISOString(),
      pii_masking_level: 'none',
      consent_mcp_checked: false,
      disagreements: [],
    },
  };
}

// ============================================================================
// TESTS - Hash Functions
// ============================================================================

describe('Cache Key - Hash Functions', () => {
  describe('hashObject', () => {
    it('should produce stable hashes for same object', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const hash1 = hashJobSpec(obj as any);
      const hash2 = hashJobSpec(obj as any);

      expect(hash1).toBe(hash2);
    });

    it('should produce same hash regardless of key order', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { c: 3, a: 1, b: 2 }; // Ordre différent

      const hash1 = hashJobSpec(obj1 as any);
      const hash2 = hashJobSpec(obj2 as any);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different objects', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 }; // Valeur différente

      const hash1 = hashObject(obj1);
      const hash2 = hashObject(obj2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashCV', () => {
    it('should produce same hash for identical CVs', () => {
      const cv1 = { ...cvTeacher };
      const cv2 = { ...cvTeacher };

      const hash1 = hashCV(cv1);
      const hash2 = hashCV(cv2);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different CVs', () => {
      const hash1 = hashCV(cvTeacher);
      const hash2 = hashCV(cvPainter);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashJobSpec', () => {
    it('should produce same hash for identical JobSpecs', () => {
      const job1 = { ...jobFLE };
      const job2 = { ...jobFLE };

      const hash1 = hashJobSpec(job1);
      const hash2 = hashJobSpec(job2);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different JobSpecs', () => {
      const hash1 = hashJobSpec(jobFLE);
      const hash2 = hashJobSpec(jobPainter);

      expect(hash1).not.toBe(hash2);
    });

    it('should change hash if must_have rules change', () => {
      const job1 = { ...jobFLE };
      const job2 = {
        ...jobFLE,
        must_have: [
          ...jobFLE.must_have,
          { id: 'NEW_RULE', desc: 'Nouvelle règle', severity: 'standard' as const },
        ],
      };

      const hash1 = hashJobSpec(job1);
      const hash2 = hashJobSpec(job2);

      expect(hash1).not.toBe(hash2);
    });
  });
});

// ============================================================================
// TESTS - Cache Key Generation
// ============================================================================

describe('Cache Key - Generation', () => {
  it('should generate valid cache key with all components', () => {
    const key = generateCacheKey({
      cvJson: cvTeacher,
      projectId: 'project-fle-2025',
      jobSpec: jobFLE,
      mode: 'balanced',
    });

    expect(key).toMatch(/^corematch:cv:[a-f0-9]{16}:project:project-fle-2025:job:[a-f0-9]{16}:mode:balanced$/);
  });

  it('should generate DIFFERENT keys for same CV but different jobs', () => {
    const keyFLE = generateCacheKey({
      cvJson: cvTeacher,
      projectId: 'project-1',
      jobSpec: jobFLE,
      mode: 'balanced',
    });

    const keyPainter = generateCacheKey({
      cvJson: cvTeacher, // Même CV !
      projectId: 'project-2',
      jobSpec: jobPainter, // Job différent !
      mode: 'balanced',
    });

    expect(keyFLE).not.toBe(keyPainter);

    // Vérifier que les jobHashes sont différents
    const parsedFLE = parseCacheKey(keyFLE);
    const parsedPainter = parseCacheKey(keyPainter);

    expect(parsedFLE?.jobHash).not.toBe(parsedPainter?.jobHash);
  });

  it('should generate DIFFERENT keys for same CV and job but different projects', () => {
    const key1 = generateCacheKey({
      cvJson: cvTeacher,
      projectId: 'project-1',
      jobSpec: jobFLE,
      mode: 'balanced',
    });

    const key2 = generateCacheKey({
      cvJson: cvTeacher,
      projectId: 'project-2', // Projet différent
      jobSpec: jobFLE,
      mode: 'balanced',
    });

    expect(key1).not.toBe(key2);
  });

  it('should generate DIFFERENT keys for different modes', () => {
    const keyBalanced = generateCacheKey({
      cvJson: cvTeacher,
      projectId: 'project-1',
      jobSpec: jobFLE,
      mode: 'balanced',
    });

    const keyPremium = generateCacheKey({
      cvJson: cvTeacher,
      projectId: 'project-1',
      jobSpec: jobFLE,
      mode: 'premium', // Mode différent
    });

    expect(keyBalanced).not.toBe(keyPremium);
  });

  it('should generate SAME key for identical parameters', () => {
    const params = {
      cvJson: cvTeacher,
      projectId: 'project-1',
      jobSpec: jobFLE,
      mode: 'balanced' as const,
    };

    const key1 = generateCacheKey(params);
    const key2 = generateCacheKey(params);

    expect(key1).toBe(key2);
  });
});

// ============================================================================
// TESTS - Cache Store
// ============================================================================

describe('Cache Store - In-Memory', () => {
  let cache: InMemoryCacheStore;

  beforeEach(() => {
    resetCacheStore();
    cache = new InMemoryCacheStore({ defaultTTL: 3600, enableAutoCleanup: false });
  });

  afterEach(async () => {
    await cache.clear();
    cache.stopAutoCleanup();
  });

  it('should store and retrieve cached results', async () => {
    const key = generateCacheKey({
      cvJson: cvTeacher,
      projectId: 'project-1',
      jobSpec: jobFLE,
      mode: 'balanced',
    });

    const result = createMockResult(85);

    await cache.set(key, result);
    const retrieved = await cache.get(key);

    expect(retrieved).toBeDefined();
    expect(retrieved?.final_decision.overall_score_0_to_100).toBe(85);
  });

  it('should return null for non-existent keys', async () => {
    const result = await cache.get('non-existent-key');
    expect(result).toBeNull();
  });

  it('should respect TTL expiration', async () => {
    const key = 'test-key';
    const result = createMockResult(80);

    await cache.set(key, result, 1); // 1 seconde TTL

    // Immédiatement après, doit être présent
    let retrieved = await cache.get(key);
    expect(retrieved).toBeDefined();

    // Attendre 1.5 secondes
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Doit être expiré
    retrieved = await cache.get(key);
    expect(retrieved).toBeNull();
  });

  it('should delete entries', async () => {
    const key = 'test-key';
    const result = createMockResult(80);

    await cache.set(key, result);
    expect(await cache.has(key)).toBe(true);

    await cache.delete(key);
    expect(await cache.has(key)).toBe(false);
  });

  it('should clear all entries', async () => {
    await cache.set('key1', createMockResult(80));
    await cache.set('key2', createMockResult(90));

    expect(await cache.size()).toBe(2);

    await cache.clear();
    expect(await cache.size()).toBe(0);
  });
});

// ============================================================================
// TEST CRITIQUE - Isolation par Job
// ============================================================================

describe('CRITICAL TEST - Job Isolation (No "Fuites de Poste")', () => {
  let cache: InMemoryCacheStore;

  beforeEach(() => {
    resetCacheStore();
    cache = new InMemoryCacheStore({ defaultTTL: 3600, enableAutoCleanup: false });
  });

  afterEach(async () => {
    await cache.clear();
    cache.stopAutoCleanup();
  });

  it('should NOT reuse cache for same CV analyzed for different jobs', async () => {
    // Analyser CV Teacher pour Job FLE
    const keyFLE = generateCacheKey({
      cvJson: cvTeacher,
      projectId: 'project-fle',
      jobSpec: jobFLE,
      mode: 'balanced',
    });

    const resultFLE = createMockResult(85); // Score élevé pour FLE
    await cache.set(keyFLE, resultFLE);

    // Analyser MÊME CV Teacher pour Job Painter
    const keyPainter = generateCacheKey({
      cvJson: cvTeacher, // ⚠️ MÊME CV
      projectId: 'project-painter',
      jobSpec: jobPainter, // ⚠️ JOB DIFFÉRENT
      mode: 'balanced',
    });

    // Ne doit PAS trouver de cache (clé différente)
    const cachedPainter = await cache.get(keyPainter);
    expect(cachedPainter).toBeNull(); // ✅ Pas de réutilisation !

    // Simuler nouvelle analyse pour Painter
    const resultPainter = createMockResult(20); // Score faible pour Painter
    await cache.set(keyPainter, resultPainter);

    // Vérifier que les 2 résultats sont indépendants
    const retrievedFLE = await cache.get(keyFLE);
    const retrievedPainter = await cache.get(keyPainter);

    expect(retrievedFLE?.final_decision.overall_score_0_to_100).toBe(85);
    expect(retrievedPainter?.final_decision.overall_score_0_to_100).toBe(20);

    // Vérifier que les clés sont bien différentes
    expect(keyFLE).not.toBe(keyPainter);
  });

  it('should detect job changes via hash comparison', () => {
    const job1 = { ...jobFLE };
    const job2 = {
      ...jobFLE,
      skills_required: [...jobFLE.skills_required, 'Nouvelle compétence'],
    };

    expect(areJobSpecsEqual(job1, job2)).toBe(false);

    // Les clés de cache doivent être différentes
    const key1 = generateCacheKey({
      cvJson: cvTeacher,
      projectId: 'project-1',
      jobSpec: job1,
      mode: 'balanced',
    });

    const key2 = generateCacheKey({
      cvJson: cvTeacher,
      projectId: 'project-1',
      jobSpec: job2,
      mode: 'balanced',
    });

    expect(key1).not.toBe(key2);
  });
});

// ============================================================================
// TEST - Parsing de clés
// ============================================================================

describe('Cache Key - Parsing', () => {
  it('should parse valid cache key', () => {
    const key = generateCacheKey({
      cvJson: cvTeacher,
      projectId: 'project-fle-2025',
      jobSpec: jobFLE,
      mode: 'balanced',
      analysisDate: '2025-01-26',
    });

    const parsed = parseCacheKey(key);

    expect(parsed).toBeDefined();
    expect(parsed?.projectId).toBe('project-fle-2025');
    expect(parsed?.mode).toBe('balanced');
    expect(parsed?.analysisDate).toBe('2025-01-26');
    expect(parsed?.cvHash).toMatch(/^[a-f0-9]{16}$/);
    expect(parsed?.jobHash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should return null for invalid cache key', () => {
    const parsed = parseCacheKey('invalid-key-format');
    expect(parsed).toBeNull();
  });
});
