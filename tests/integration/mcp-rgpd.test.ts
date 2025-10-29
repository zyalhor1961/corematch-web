/**
 * Tests RGPD - PII Masking & Consent
 *
 * OBJECTIF: Valider la conformité RGPD du système MCP
 *
 * Tests critiques:
 * 1. PII Masking selon niveaux (none/partial/full)
 * 2. Consent MCP requis avant analyse
 * 3. Audit trail des accès
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  maskPII,
  isMasked,
  detectMaskingLevel,
  validateAnalysisRequest,
} from '@/lib/mcp/security/pii-masking';
import type { CV_JSON } from '@/lib/cv-analysis/types';
import type { PIIMaskingLevel } from '@/lib/mcp/types/context-snapshot';

// ============================================================================
// FIXTURES - CV de test avec PII complètes
// ============================================================================

const cvWithFullPII: CV_JSON = {
  identite: {
    prenom: 'Sophie',
    nom: 'Dubois',
    email: 'sophie.dubois@example.com',
    linkedin: 'linkedin.com/in/sophie-dubois',
  },
  experiences: [
    {
      index: 0,
      titre: 'Développeuse Full Stack',
      employeur: 'TechCorp Paris',
      date_debut: '2021-03',
      date_fin: null,
      missions: [
        'Développement applications React/Node.js',
        'Architecture microservices',
        'Mentorat junior devs',
      ],
    },
    {
      index: 1,
      titre: 'Développeuse Frontend',
      employeur: 'StartupXYZ',
      date_debut: '2018-09',
      date_fin: '2021-02',
      missions: ['Développement React', 'Intégration APIs REST'],
    },
  ],
  formations: [
    {
      index: 0,
      intitule: 'Master Informatique',
      etablissement: 'Université Paris-Saclay',
      annee: '2018',
    },
  ],
  competences: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker'],
  langues: [
    { langue: 'Français', niveau: 'Natif' },
    { langue: 'Anglais', niveau: 'C1' },
  ],
  certifications: [{ nom: 'AWS Solutions Architect', organisme: 'Amazon Web Services' }],
};

// ============================================================================
// TESTS - PII Masking par niveau
// ============================================================================

describe('PII Masking - Levels', () => {
  describe('Level: none', () => {
    it('should NOT mask any fields', () => {
      const { masked, stats } = maskPII(cvWithFullPII, 'none');

      expect(masked.identite.prenom).toBe('Sophie');
      expect(masked.identite.nom).toBe('Dubois');
      expect(masked.identite.email).toBe('sophie.dubois@example.com');
      expect(masked.identite.linkedin).toBe('linkedin.com/in/sophie-dubois');
      expect(masked.experiences[0].employeur).toBe('TechCorp Paris');

      expect(stats.masked_count).toBe(0);
      expect(stats.fields_masked).toHaveLength(0);
    });
  });

  describe('Level: partial', () => {
    it('should mask email, linkedin, phone but keep name and employers', () => {
      const { masked, stats } = maskPII(cvWithFullPII, 'partial');

      // Name should be kept
      expect(masked.identite.prenom).toBe('Sophie');
      expect(masked.identite.nom).toBe('Dubois');

      // Email/LinkedIn should be masked
      expect(masked.identite.email).toBe('[EMAIL_MASKED]');
      expect(masked.identite.linkedin).toBe('[LINKEDIN_MASKED]');

      // Employers should be kept
      expect(masked.experiences[0].employeur).toBe('TechCorp Paris');
      expect(masked.experiences[1].employeur).toBe('StartupXYZ');

      // Stats
      expect(stats.masked_count).toBe(2); // email + linkedin
      expect(stats.fields_masked).toContain('identite.email');
      expect(stats.fields_masked).toContain('identite.linkedin');
    });

    it('should be detected as masked', () => {
      const { masked } = maskPII(cvWithFullPII, 'partial');
      expect(isMasked(masked)).toBe(true);
      expect(detectMaskingLevel(masked)).toBe('partial');
    });
  });

  describe('Level: full', () => {
    it('should mask all PII including name and employers', () => {
      const { masked, stats } = maskPII(cvWithFullPII, 'full');

      // Name should be masked
      expect(masked.identite.prenom).toBe('[PRENOM_MASKED]');
      expect(masked.identite.nom).toBe('[NOM_MASKED]');

      // Email/LinkedIn should be masked
      expect(masked.identite.email).toBe('[EMAIL_MASKED]');
      expect(masked.identite.linkedin).toBe('[LINKEDIN_MASKED]');

      // Employers should be masked
      expect(masked.experiences[0].employeur).toBe('[COMPANY_MASKED]');
      expect(masked.experiences[1].employeur).toBe('[COMPANY_MASKED]');

      // Etablissements should be masked
      expect(masked.formations[0].etablissement).toBe('[SCHOOL_MASKED]');

      // Stats
      expect(stats.masked_count).toBeGreaterThan(4); // At least name + email + linkedin + employers
      expect(stats.fields_masked).toContain('identite.prenom');
      expect(stats.fields_masked).toContain('identite.nom');
      expect(stats.fields_masked).toContain('identite.email');
      expect(stats.fields_masked).toContain('experiences[0].employeur');
    });

    it('should be detected as full masking', () => {
      const { masked } = maskPII(cvWithFullPII, 'full');
      expect(isMasked(masked)).toBe(true);
      expect(detectMaskingLevel(masked)).toBe('full');
    });

    it('should still preserve relevant professional data', () => {
      const { masked } = maskPII(cvWithFullPII, 'full');

      // Titres, missions, compétences doivent être préservés
      expect(masked.experiences[0].titre).toBe('Développeuse Full Stack');
      expect(masked.experiences[0].missions).toContain('Développement applications React/Node.js');
      expect(masked.competences).toContain('React');
      expect(masked.formations[0].intitule).toBe('Master Informatique');
    });
  });
});

// ============================================================================
// TESTS - Immutabilité (pas de modification de l'original)
// ============================================================================

describe('PII Masking - Immutability', () => {
  it('should NOT mutate original CV object', () => {
    const original = { ...cvWithFullPII };
    const originalEmail = original.identite.email;
    const originalPrenom = original.identite.prenom;

    const { masked } = maskPII(original, 'full');

    // L'original ne doit PAS être modifié
    expect(original.identite.email).toBe(originalEmail);
    expect(original.identite.prenom).toBe(originalPrenom);
    expect(original.experiences[0].employeur).toBe('TechCorp Paris');

    // Le masqué doit être différent
    expect(masked.identite.email).not.toBe(originalEmail);
    expect(masked.identite.prenom).not.toBe(originalPrenom);
  });
});

// ============================================================================
// TESTS - Cas particuliers
// ============================================================================

describe('PII Masking - Edge Cases', () => {
  it('should handle CV with missing email/linkedin', () => {
    const cvNoEmail: CV_JSON = {
      ...cvWithFullPII,
      identite: {
        prenom: 'Jean',
        nom: 'Martin',
        // Pas d'email ni linkedin
      },
    };

    const { masked, stats } = maskPII(cvNoEmail, 'partial');

    expect(masked.identite.prenom).toBe('Jean');
    expect(masked.identite.email).toBeUndefined();
    expect(masked.identite.linkedin).toBeUndefined();

    // Aucun champ masqué car aucun PII sensible présent
    expect(stats.masked_count).toBe(0);
  });

  it('should handle CV with no employers', () => {
    const cvNoEmployers: CV_JSON = {
      ...cvWithFullPII,
      experiences: [
        {
          index: 0,
          titre: 'Freelance',
          // Pas d'employeur
          date_debut: '2020-01',
          date_fin: null,
        },
      ],
    };

    const { masked } = maskPII(cvNoEmployers, 'full');

    expect(masked.experiences[0].employeur).toBeUndefined();
  });

  it('should produce consistent masks for same CV', () => {
    const { masked: masked1 } = maskPII(cvWithFullPII, 'partial');
    const { masked: masked2 } = maskPII(cvWithFullPII, 'partial');

    expect(masked1.identite.email).toBe(masked2.identite.email);
    expect(masked1.identite.linkedin).toBe(masked2.identite.linkedin);
  });
});

// ============================================================================
// TESTS - Detection de masking
// ============================================================================

describe('PII Masking - Detection', () => {
  it('should detect unmasked CV', () => {
    expect(isMasked(cvWithFullPII)).toBe(false);
    expect(detectMaskingLevel(cvWithFullPII)).toBe('none');
  });

  it('should detect partial masking', () => {
    const { masked } = maskPII(cvWithFullPII, 'partial');
    expect(isMasked(masked)).toBe(true);
    expect(detectMaskingLevel(masked)).toBe('partial');
  });

  it('should detect full masking', () => {
    const { masked } = maskPII(cvWithFullPII, 'full');
    expect(isMasked(masked)).toBe(true);
    expect(detectMaskingLevel(masked)).toBe('full');
  });
});

// ============================================================================
// TESTS - Consent MCP (avec mocks Supabase)
// ============================================================================

describe('RGPD Consent - Validation', () => {
  // Note: Ces tests nécessitent des mocks Supabase
  // À implémenter quand checkMCPConsent() sera connecté à Supabase

  it.skip('should reject analysis if consent not granted', async () => {
    // Mock: candidat sans consent
    const candidateId = 'candidate-no-consent';

    await expect(
      validateAnalysisRequest({
        candidateId,
        projectId: 'project-1',
        requireConsent: true,
      })
    ).rejects.toThrow('ERROR_CONSENT_REQUIRED');
  });

  it.skip('should allow analysis if consent granted', async () => {
    // Mock: candidat avec consent
    const candidateId = 'candidate-with-consent';

    const result = await validateAnalysisRequest({
      candidateId,
      projectId: 'project-1',
      requireConsent: true,
    });

    expect(result.consent_granted).toBe(true);
  });

  it.skip('should skip consent check if not required', async () => {
    const candidateId = 'any-candidate';

    const result = await validateAnalysisRequest({
      candidateId,
      projectId: 'project-1',
      requireConsent: false, // Pas de check consent
    });

    expect(result.consent_granted).toBe(false);
    // Ne doit pas throw
  });
});

// ============================================================================
// TEST CRITIQUE - Isolation PII par niveau
// ============================================================================

describe('CRITICAL TEST - PII Protection', () => {
  it('should NEVER leak PII in partial masking', () => {
    const { masked } = maskPII(cvWithFullPII, 'partial');

    // Vérifier qu'aucun champ PII sensible n'est présent
    const jsonString = JSON.stringify(masked);

    expect(jsonString).not.toContain('sophie.dubois@example.com');
    expect(jsonString).not.toContain('linkedin.com/in/sophie-dubois');

    // Mais le nom doit être présent
    expect(jsonString).toContain('Sophie');
    expect(jsonString).toContain('Dubois');
  });

  it('should NEVER leak PII in full masking', () => {
    const { masked } = maskPII(cvWithFullPII, 'full');

    const jsonString = JSON.stringify(masked);

    // Vérifier qu'AUCUNE PII n'est présente
    expect(jsonString).not.toContain('Sophie');
    expect(jsonString).not.toContain('Dubois');
    expect(jsonString).not.toContain('sophie.dubois@example.com');
    expect(jsonString).not.toContain('linkedin.com/in/sophie-dubois');
    expect(jsonString).not.toContain('TechCorp Paris');
    expect(jsonString).not.toContain('StartupXYZ');
    expect(jsonString).not.toContain('Université Paris-Saclay');

    // Mais les données professionnelles doivent être préservées
    expect(jsonString).toContain('Développeuse Full Stack');
    expect(jsonString).toContain('React');
    expect(jsonString).toContain('Master Informatique');
  });
});

// ============================================================================
// TEST - Combinaison Masking + Cache Key
// ============================================================================

describe('Integration - Masking + Cache Key', () => {
  it('should generate different cache keys for different masking levels', () => {
    // Ce test sera utile quand on intégrera masking dans orchestrator
    // Pour l'instant, juste valider que maskPII produit des CVs différents

    const { masked: maskedPartial } = maskPII(cvWithFullPII, 'partial');
    const { masked: maskedFull } = maskPII(cvWithFullPII, 'full');

    expect(JSON.stringify(maskedPartial)).not.toBe(JSON.stringify(maskedFull));
  });
});

// ============================================================================
// TEST - Stats de masking
// ============================================================================

describe('PII Masking - Statistics', () => {
  it('should provide accurate masking statistics', () => {
    const { stats } = maskPII(cvWithFullPII, 'full');

    expect(stats.level).toBe('full');
    expect(stats.masked_count).toBeGreaterThan(0);
    expect(stats.fields_masked.length).toBe(stats.masked_count);

    // Vérifier que tous les champs masqués sont dans la liste
    expect(stats.fields_masked).toContain('identite.prenom');
    expect(stats.fields_masked).toContain('identite.nom');
    expect(stats.fields_masked).toContain('identite.email');
  });

  it('should track all masked fields for audit', () => {
    const cvWithPhone = {
      ...cvWithFullPII,
      identite: {
        ...cvWithFullPII.identite,
        telephone: '+33612345678',
      },
    };

    const { stats } = maskPII(cvWithPhone as CV_JSON, 'partial');

    expect(stats.fields_masked).toContain('identite.email');
    expect(stats.fields_masked).toContain('identite.linkedin');
    expect(stats.fields_masked).toContain('identite.telephone');
    expect(stats.masked_count).toBe(3);
  });
});
