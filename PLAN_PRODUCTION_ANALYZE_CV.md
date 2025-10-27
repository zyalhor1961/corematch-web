# 🚀 Plan de Bascule en Production : analyze_cv

**Date**: 2025-10-27
**Objectif**: Passer de MODE MOCK à Production pour analyser de vrais CVs

---

## 📊 État Actuel

### Ce qui fonctionne en MODE MOCK
- ✅ Serveur MCP connecté
- ✅ `get_candidates` utilise la vraie DB
- ✅ `analyze_cv` utilise des données de test
- ✅ Bypass de la vérification `job_spec_config`

### Blocage Principal
❌ **Aucun projet en production n'a de `job_spec_config`**

**Vérification faite** :
```bash
# Script: scripts/find-projects-with-jobspec.ts
# Résultat: 0 projets sur 25 ont job_spec_config
# Tous utilisent l'ancien format "requirements" (TEXT)
```

---

## 🎯 Stratégie Recommandée : 3 Options

### Option A : Migration via Interface Web (Recommandé pour 1-2 projets)
**Temps** : 15-30 min par projet
**Difficulté** : Facile
**Idéal pour** : Tests initiaux

### Option B : Script de Migration Automatique (Recommandé pour tous les projets)
**Temps** : 1 heure de dev + 5 min d'exécution
**Difficulté** : Moyenne
**Idéal pour** : Migration complète

### Option C : Support Dual Format (Recommandé pour transition)
**Temps** : 2 heures de dev
**Difficulté** : Moyenne-Élevée
**Idéal pour** : Compatibilité pendant la migration

---

## 📋 Option A : Migration Manuelle (1 Projet de Test)

### Étape 1 : Identifier un Projet Test

**Projet suggéré** :
```
ID: 037e7639-3d42-45f1-86c2-1f21a72fb96a
Nom: (à vérifier dans l'interface)
Raison: Déjà utilisé pour les tests MCP
```

### Étape 2 : Récupérer les Requirements Actuels

Script à exécuter :
```typescript
// scripts/get-project-requirements.ts
import { supabaseAdmin } from '../lib/supabase/admin';

const projectId = '037e7639-3d42-45f1-86c2-1f21a72fb96a';

async function getRequirements() {
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('name, requirements, job_title')
    .eq('id', projectId)
    .single();

  console.log('Project:', project.name);
  console.log('Job Title:', project.job_title);
  console.log('\nRequirements (TEXT):');
  console.log(project.requirements);
}

getRequirements();
```

### Étape 3 : Convertir en Format Structuré

**Format cible** (job_spec_config JSONB) :
```json
{
  "job_title": "Développeur React Senior",
  "mission": "Développer et maintenir des applications web React",
  "context": "Startup tech en forte croissance",
  "required_skills": [
    {
      "name": "React",
      "category": "HARD_TECHNICAL",
      "level": "EXPERT",
      "min_years": 5,
      "is_mandatory": true,
      "keywords": ["React", "ReactJS", "React.js"],
      "equivalents": ["Vue.js (avec 7+ ans)", "Angular (avec 7+ ans)"]
    },
    {
      "name": "TypeScript",
      "category": "HARD_TECHNICAL",
      "level": "CONFIRMED",
      "min_years": 3,
      "is_mandatory": true,
      "keywords": ["TypeScript", "TS"],
      "equivalents": []
    }
  ],
  "nice_to_have_skills": [
    {
      "name": "Docker",
      "category": "HARD_TECHNICAL",
      "level": "INTERMEDIATE",
      "keywords": ["Docker", "Containerization"],
      "bonus_points": 10
    }
  ],
  "soft_skills": [
    {
      "name": "Travail en équipe",
      "importance": "HIGH",
      "keywords": ["collaboration", "équipe", "team"]
    }
  ],
  "languages": [
    {
      "language": "Français",
      "level": "NATIVE",
      "is_mandatory": true
    },
    {
      "language": "Anglais",
      "level": "PROFESSIONAL",
      "is_mandatory": false
    }
  ]
}
```

### Étape 4 : Mettre à Jour via l'Interface Web

1. **Se connecter** à Corematch (http://localhost:3000 ou production)
2. **Ouvrir le projet** `037e7639-3d42-45f1-86c2-1f21a72fb96a`
3. **Aller dans "Configuration"** ou "Job Specification"
4. **Remplir le formulaire structuré** :
   - Titre du poste
   - Compétences requises (avec niveaux, années d'expérience)
   - Compétences optionnelles
   - Soft skills
   - Langues
5. **Sauvegarder**

### Étape 5 : Vérifier la Migration

Script de vérification :
```bash
npx tsx scripts/check-project-details.ts
```

**Résultat attendu** :
```
✅ job_spec_config is configured (JSONB)
   Type: object
   Keys: job_title, required_skills, nice_to_have_skills, ...
```

### Étape 6 : Passer en Mode Production

1. **Éditer** `F:\corematch\start-mcp-server.bat`
2. **Commenter** la ligne :
   ```batch
   REM set MCP_MOCK_MODE=true
   ```
3. **Redémarrer** le serveur MCP dans Claude Desktop
4. **Tester** avec un vrai candidat :
   ```
   Analyse le CV du candidat [REAL_CANDIDATE_ID]
   pour le projet 037e7639-3d42-45f1-86c2-1f21a72fb96a
   ```

---

## 🔧 Option B : Script de Migration Automatique

### Script de Migration

Je vais créer un script qui convertit automatiquement les `requirements` TEXT en `job_spec_config` JSONB.

**Fichier** : `scripts/migrate-requirements-to-jobspec.ts`

### Fonctionnalités du Script

1. **Analyse du texte requirements** via GPT-4/Claude
2. **Extraction automatique** :
   - Titre du poste
   - Compétences techniques requises
   - Compétences optionnelles
   - Soft skills
   - Langues
3. **Génération du JSONB structuré**
4. **Mise à jour de la DB**
5. **Validation et rollback** si erreur

### Étape 1 : Créer le Script

```typescript
// scripts/migrate-requirements-to-jobspec.ts
import { supabaseAdmin } from '../lib/supabase/admin';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface JobSpecConfig {
  job_title: string;
  mission: string;
  context: string;
  required_skills: Array<{
    name: string;
    category: string;
    level: string;
    min_years: number;
    is_mandatory: boolean;
    keywords: string[];
    equivalents: string[];
  }>;
  nice_to_have_skills: Array<{
    name: string;
    category: string;
    level: string;
    keywords: string[];
    bonus_points: number;
  }>;
  soft_skills: Array<{
    name: string;
    importance: string;
    keywords: string[];
  }>;
  languages: Array<{
    language: string;
    level: string;
    is_mandatory: boolean;
  }>;
}

async function convertRequirementsToJobSpec(
  requirements: string,
  jobTitle: string
): Promise<JobSpecConfig> {
  const prompt = `
Tu es un expert RH. Convertis ces exigences de poste en format structuré JSON.

TITRE DU POSTE: ${jobTitle}

EXIGENCES (texte libre):
${requirements}

Retourne un objet JSON avec cette structure EXACTE:
{
  "job_title": "titre exact du poste",
  "mission": "description courte de la mission",
  "context": "contexte de l'entreprise/projet",
  "required_skills": [
    {
      "name": "Nom de la compétence",
      "category": "HARD_TECHNICAL | HARD_DOMAIN | HARD_TOOL",
      "level": "BEGINNER | INTERMEDIATE | CONFIRMED | EXPERT",
      "min_years": nombre d'années minimum,
      "is_mandatory": true/false,
      "keywords": ["mot-clé 1", "mot-clé 2"],
      "equivalents": ["équivalent possible"]
    }
  ],
  "nice_to_have_skills": [...],
  "soft_skills": [
    {
      "name": "Nom du soft skill",
      "importance": "LOW | MEDIUM | HIGH",
      "keywords": ["mots-clés associés"]
    }
  ],
  "languages": [
    {
      "language": "Français",
      "level": "BASIC | CONVERSATIONAL | PROFESSIONAL | NATIVE",
      "is_mandatory": true/false
    }
  ]
}

IMPORTANT:
- Extrait TOUTES les compétences mentionnées
- Sois précis sur les niveaux et années d'expérience
- Identifie les compétences obligatoires vs optionnelles
- Inclus les soft skills même s'ils sont implicites
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: 'Tu es un expert RH qui structure des fiches de poste.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  return JSON.parse(content);
}

async function migrateProject(projectId: string, dryRun: boolean = true) {
  console.log(`\n🔍 Processing project ${projectId}...`);

  // 1. Récupérer le projet
  const { data: project, error } = await supabaseAdmin
    .from('projects')
    .select('id, name, job_title, requirements, job_spec_config')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    console.error(`❌ Project not found: ${error?.message}`);
    return;
  }

  console.log(`📋 Project: ${project.name}`);
  console.log(`   Job Title: ${project.job_title || 'N/A'}`);

  // 2. Vérifier si déjà migré
  if (project.job_spec_config) {
    console.log(`⏭️  Already migrated, skipping`);
    return;
  }

  // 3. Vérifier qu'il y a des requirements
  if (!project.requirements || project.requirements.trim() === '') {
    console.log(`⚠️  No requirements to migrate`);
    return;
  }

  console.log(`\n📝 Original requirements (${project.requirements.length} chars):`);
  console.log(project.requirements.substring(0, 200) + '...');

  // 4. Convertir via GPT-4
  console.log(`\n🤖 Converting with GPT-4...`);
  const jobSpec = await convertRequirementsToJobSpec(
    project.requirements,
    project.job_title || project.name
  );

  console.log(`\n✅ Converted to structured format:`);
  console.log(`   Job Title: ${jobSpec.job_title}`);
  console.log(`   Required Skills: ${jobSpec.required_skills.length}`);
  console.log(`   Nice-to-have: ${jobSpec.nice_to_have_skills.length}`);
  console.log(`   Soft Skills: ${jobSpec.soft_skills.length}`);
  console.log(`   Languages: ${jobSpec.languages.length}`);

  if (dryRun) {
    console.log(`\n🧪 DRY RUN - Would update database with:`);
    console.log(JSON.stringify(jobSpec, null, 2));
    return jobSpec;
  }

  // 5. Mettre à jour la DB
  console.log(`\n💾 Updating database...`);
  const { error: updateError } = await supabaseAdmin
    .from('projects')
    .update({
      job_spec_config: jobSpec,
      job_title: jobSpec.job_title, // Mettre à jour aussi job_title
    })
    .eq('id', projectId);

  if (updateError) {
    console.error(`❌ Update failed: ${updateError.message}`);
    throw updateError;
  }

  console.log(`✅ Project migrated successfully!`);
  return jobSpec;
}

async function migrateAllProjects(dryRun: boolean = true) {
  console.log(`\n🚀 Starting migration of all projects (dry run: ${dryRun})`);

  // Récupérer tous les projets sans job_spec_config
  const { data: projects, error } = await supabaseAdmin
    .from('projects')
    .select('id, name, job_title')
    .is('job_spec_config', null)
    .not('requirements', 'is', null);

  if (error) {
    console.error(`❌ Failed to fetch projects: ${error.message}`);
    return;
  }

  console.log(`\n📊 Found ${projects.length} projects to migrate`);

  for (const project of projects) {
    try {
      await migrateProject(project.id, dryRun);
    } catch (error: any) {
      console.error(`\n❌ Failed to migrate ${project.name}:`, error.message);
      console.log(`   Continuing with next project...`);
    }
  }

  console.log(`\n🎉 Migration complete!`);
}

// Usage
const args = process.argv.slice(2);
const command = args[0];
const projectId = args[1];
const dryRun = !args.includes('--no-dry-run');

if (command === 'single' && projectId) {
  migrateProject(projectId, dryRun).catch(console.error);
} else if (command === 'all') {
  migrateAllProjects(dryRun).catch(console.error);
} else {
  console.log(`
Usage:
  # Test migration d'un projet (dry run)
  npx tsx scripts/migrate-requirements-to-jobspec.ts single [PROJECT_ID]

  # Migrer réellement un projet
  npx tsx scripts/migrate-requirements-to-jobspec.ts single [PROJECT_ID] --no-dry-run

  # Test migration de tous les projets (dry run)
  npx tsx scripts/migrate-requirements-to-jobspec.ts all

  # Migrer réellement tous les projets
  npx tsx scripts/migrate-requirements-to-jobspec.ts all --no-dry-run
  `);
}
```

### Étape 2 : Tester la Migration (Dry Run)

```bash
# Test sur UN projet
npx tsx scripts/migrate-requirements-to-jobspec.ts single 037e7639-3d42-45f1-86c2-1f21a72fb96a

# Le script affichera le résultat SANS modifier la DB
```

### Étape 3 : Valider le Résultat

Vérifier que la conversion est correcte :
- Compétences bien extraites
- Niveaux cohérents
- Années d'expérience correctes

### Étape 4 : Migrer Pour de Vrai

```bash
# Migrer UN projet
npx tsx scripts/migrate-requirements-to-jobspec.ts single 037e7639-3d42-45f1-86c2-1f21a72fb96a --no-dry-run

# OU migrer TOUS les projets
npx tsx scripts/migrate-requirements-to-jobspec.ts all --no-dry-run
```

### Étape 5 : Passer en Production

Même que Option A - Étape 6.

---

## 🔀 Option C : Support Dual Format (Transition Progressive)

### Objectif
Permettre à `analyze_cv` de fonctionner avec SOIT :
- `job_spec_config` (nouveau format JSONB)
- `requirements` (ancien format TEXT)

### Avantages
- ✅ Pas de migration immédiate nécessaire
- ✅ Compatible avec anciens et nouveaux projets
- ✅ Transition en douceur

### Inconvénients
- ❌ Code plus complexe
- ❌ Analyse moins précise avec format TEXT
- ❌ Maintenance de deux formats

### Implémentation

Modifier `lib/mcp/server/tools/analyze-cv.ts` :

```typescript
// Après avoir récupéré le projet
const { data: project } = await supabaseAdmin
  .from('projects')
  .select('id, name, job_spec_config, requirements, job_title')
  .eq('id', args.projectId)
  .single();

// Adapter le JobSpec selon le format disponible
let jobSpec: JobSpec;

if (project.job_spec_config) {
  // Format nouveau - JSONB structuré
  console.error('✅ Using structured job_spec_config (JSONB)');
  jobSpec = project.job_spec_config as JobSpec;
} else if (project.requirements) {
  // Format ancien - TEXT simple
  console.error('⚠️  Using legacy requirements (TEXT) - converting on-the-fly');
  jobSpec = await convertRequirementsToJobSpec(
    project.requirements,
    project.job_title || project.name
  );
} else {
  throw new Error('JOB_SPEC_MISSING: Project has no job specification');
}
```

Créer la fonction de conversion :
```typescript
async function convertRequirementsToJobSpec(
  requirements: string,
  jobTitle: string
): Promise<JobSpec> {
  // Utiliser GPT-4 pour convertir à la volée
  // Ou parser simple pour extraction basique
  // Voir le code complet dans Option B
}
```

---

## 📊 Comparaison des Options

| Critère | Option A (Manuel) | Option B (Script) | Option C (Dual) |
|---------|-------------------|-------------------|-----------------|
| **Temps initial** | 15-30 min | 1h dev + 5 min exec | 2h dev |
| **Temps par projet** | 15 min | Automatique | N/A |
| **Qualité résultat** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Scalabilité** | ❌ Pas scalable | ✅ Scalable | ✅ Scalable |
| **Maintenance** | ✅ Simple | ✅ Simple | ❌ Complexe |
| **Réversibilité** | ✅ Facile | ⚠️ Backup requis | ✅ Garde les deux |
| **Recommandé pour** | 1-2 projets test | Migration complète | Transition longue |

---

## 🎯 Ma Recommandation

### Phase 1 : Test Initial (Cette Semaine)
**Option A** - Migrer manuellement **1 projet test**
- Projet: `037e7639-3d42-45f1-86c2-1f21a72fb96a`
- Vérifier que tout fonctionne
- Ajuster le format si nécessaire

### Phase 2 : Migration Partielle (Semaine Prochaine)
**Option B** - Script automatique pour **5-10 projets prioritaires**
- Projets avec le plus de candidats
- Projets activement utilisés
- Valider la qualité de conversion

### Phase 3 : Migration Complète (Mois Prochain)
**Option B** - Migrer les **25 projets restants**
- Automatique via script
- Monitoring des résultats
- Ajustements si nécessaire

### Phase de Transition (Optionnel)
**Option C** - Support dual format pendant 1-2 mois
- Permet de tester progressivement
- Rollback facile si problème
- Supprimer une fois tous les projets migrés

---

## ✅ Checklist de Production

### Avant de Basculer
- [ ] Au moins 1 projet a `job_spec_config` configuré
- [ ] CV parser testé avec de vrais PDFs
- [ ] Supabase Service Role Key configurée
- [ ] Consent MCP vérifié pour les candidats test
- [ ] Backup de la DB effectué

### Bascule en Production
- [ ] Commenter `set MCP_MOCK_MODE=true` dans `start-mcp-server.bat`
- [ ] Redémarrer le serveur MCP dans Claude Desktop
- [ ] Vérifier status "running" dans Extensions

### Tests Post-Bascule
- [ ] Tester avec 1 candidat + 1 projet migré
- [ ] Vérifier que le score est cohérent
- [ ] Vérifier que les forces/faiblesses sont pertinentes
- [ ] Vérifier que le coût est raisonnable
- [ ] Vérifier que les résultats sont sauvegardés en DB

### Rollback si Problème
- [ ] Décommenter `set MCP_MOCK_MODE=true`
- [ ] Redémarrer le serveur
- [ ] Retour en MODE MOCK

---

## 📞 Prochaine Action Immédiate

**Je recommande** : Commencer par **Option A** - Migration manuelle d'**UN** projet test.

Voulez-vous que je :
1. **Crée le script Option B** de migration automatique ?
2. **Aide à migrer manuellement** le projet `037e7639-3d42-45f1-86c2-1f21a72fb96a` ?
3. **Implémente Option C** pour support dual format ?

Dites-moi quelle option vous préférez ! 🚀
