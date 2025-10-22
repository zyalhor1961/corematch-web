# Système d'Analyse CV Multi-Domaines

## Vue d'ensemble

CoreMatch utilise maintenant un **système d'analyse intelligent** qui s'adapte automatiquement à TOUS les types de postes. Le système détecte le domaine professionnel et applique des règles métier optimisées pour chaque secteur.

## Domaines Supportés

### 🎓 FLE (Français Langue Étrangère)
**Détection:** "fle", "français langue étrangère", "formateur fle", "enseignant fle"

**Règles de pertinence:**
- **DIRECTE:** Formateur FLE, enseignant FLE, professeur FLE, lecteur FLE, Alliance Française
- **ADJACENTE:** Interprète, traducteur, médiateur social, tuteur, alphabétisation
- **PÉRIPHÉRIQUE:** Éducation, formation, enseignement, pédagogie

**Compétences clés:** Conception de cours, évaluation, gestion de classe, didactique, CECRL

**Seuil d'expérience:** 2 ans pour score maximal

---

### 💻 Tech (Développement & IT)
**Détection:** "développeur", "developer", "ingénieur", "programmeur", "devops", "data scientist"

**Règles de pertinence:**
- **DIRECTE:** Développeur, ingénieur logiciel, DevOps, data scientist, tech lead, architecte
- **ADJACENTE:** Analyste, consultant technique, QA engineer, support technique, sysadmin
- **PÉRIPHÉRIQUE:** Informatique, technologie, digital, startup, agile

**Compétences clés:** Développement, programmation, architecture, debugging, Git

**Mapping avancé:** JavaScript/JS/Node, TypeScript/TS, Python/Py, React/ReactJS, Docker/K8s

**Seuil d'expérience:** 3 ans pour score maximal

---

### 💰 Finance (Comptabilité & Audit)
**Détection:** "comptable", "financier", "analyste financier", "contrôleur de gestion", "auditeur"

**Règles de pertinence:**
- **DIRECTE:** Comptable, analyste financier, contrôleur de gestion, auditeur, DAF
- **ADJACENTE:** Assistant comptable, gestionnaire, consultant financier
- **PÉRIPHÉRIQUE:** Banque, assurance, finance, gestion, cabinet comptable

**Compétences clés:** Comptabilité, analyse financière, reporting, Excel, normes comptables

**Mapping avancé:** IFRS/US GAAP, SAP/Oracle/Sage, fiscalité/TVA/IS

**Seuil d'expérience:** 3 ans pour score maximal

---

### 🏥 Healthcare (Santé & Médical)
**Détection:** "infirmier", "médecin", "aide-soignant", "pharmacien", "kinésithérapeute"

**Règles de pertinence:**
- **DIRECTE:** Infirmier(ère), médecin, aide-soignant(e), pharmacien(ne), psychologue
- **ADJACENTE:** Auxiliaire de santé, secrétaire médicale, ambulancier, préparateur
- **PÉRIPHÉRIQUE:** Santé, médical, hôpital, clinique, EHPAD

**Compétences clés:** Soins, diagnostic, protocoles médicaux, hygiène, relation patient

**Seuil d'expérience:** 2 ans pour score maximal (diplôme requis)

---

### 💼 Sales (Commercial & Vente)
**Détection:** "commercial", "vendeur", "business developer", "account manager"

**Règles de pertinence:**
- **DIRECTE:** Commercial(e), vendeur(se), business developer, ingénieur commercial
- **ADJACENTE:** Assistant commercial, conseiller clientèle, customer success
- **PÉRIPHÉRIQUE:** Vente, commerce, négociation, prospection, retail

**Compétences clés:** Prospection, négociation, closing, relation client, CRM

**Mapping avancé:** Salesforce/HubSpot/Zoho, B2B/B2C

**Seuil d'expérience:** 2 ans pour score maximal

---

### 📣 Marketing (Digital & Communication)
**Détection:** "marketing", "communication", "digital marketing", "community manager", "seo"

**Règles de pertinence:**
- **DIRECTE:** Marketing, digital marketing, community manager, content manager, SEO/SEM
- **ADJACENTE:** Communication, chargé de com, assistant marketing, brand manager
- **PÉRIPHÉRIQUE:** Publicité, médias, réseaux sociaux, contenu

**Compétences clés:** Stratégie marketing, digital, analytics, content, réseaux sociaux

**Mapping avancé:** SEO/référencement naturel, SEM/Google Ads, Analytics/KPI

**Seuil d'expérience:** 2 ans pour score maximal

---

### 👥 HR (Ressources Humaines & Recrutement)
**Détection:** "ressources humaines", "rh", "recrutement", "talent acquisition", "drh"

**Règles de pertinence:**
- **DIRECTE:** RH, recruteur(se), talent acquisition, chargé de recrutement, DRH
- **ADJACENTE:** Assistant RH, chargé de formation, gestionnaire paie
- **PÉRIPHÉRIQUE:** Formation, gestion des talents, paie, droit du travail

**Compétences clés:** Recrutement, entretien, sourcing, gestion RH, droit du travail

**Mapping avancé:** ATS/logiciel recrutement, LinkedIn Recruiter, SIRH/HRIS

**Seuil d'expérience:** 2 ans pour score maximal

---

### 🔧 Generic (Domaine non reconnu)
**Détection:** Fallback automatique si aucun domaine spécifique n'est détecté

**Comportement:** Extraction intelligente des mots-clés du titre et des exigences

**Seuil d'expérience:** 2 ans pour score maximal

---

## Comment ça marche ?

### 1. Détection automatique du domaine

Quand un projet est créé ou analysé, le système:
1. Analyse le **titre du poste**
2. Analyse les **exigences** (requirements)
3. Analyse la **description**

Si au moins 1 mot-clé correspond à un domaine → Template appliqué

**Exemple:**
```
Titre: "Développeur Full Stack React/Node"
→ Détection: TECH (mot-clé "développeur" trouvé)
→ Template tech appliqué avec mapping JS/React/Node
```

### 2. Application des règles métier

Le système applique automatiquement:
- ✅ Règles de pertinence spécifiques au domaine
- ✅ Mapping de compétences avec synonymes/alias
- ✅ Must-have requirements adaptés
- ✅ Seuils d'expérience optimisés

### 3. Scoring déterministe

**Formule:**
```
Score = 60% × Experience + 25% × Compétences + 15% × Nice-to-have

Experience_score = min(1, années_pertinentes / seuil_domaine)
- Années pertinentes = mois_DIRECTE/12 + 60% × mois_ADJACENTE/12

Compétences_score = compétences_trouvées / compétences_requises
- Utilise le mapping de synonymes pour matching intelligent

Nice-to-have_score = nice_to_have_trouvés / nice_to_have_total
```

### 4. Recommandation finale

| Score | Résultat |
|-------|----------|
| ≥ 65% | **SHORTLIST** (candidat fortement recommandé) |
| ≥ 50% | **CONSIDER** (candidat à considérer) |
| < 50% | **REJECT** (candidat non recommandé) |

**Exception:** Must-have critique non satisfait → REJECT automatique

---

## Logs de détection

Dans la console serveur, vous verrez:

```
[Domain Detection] Detected: TECH (3 keywords matched)
[Deterministic] Analyzing Jean Dupont
[Deterministic] Using model: gpt-4o
```

Ou si domaine non reconnu:
```
[Domain Detection] No specific domain detected, using GENERIC template
```

---

## Avantages du système multi-domaines

✅ **Adaptabilité:** Fonctionne pour TOUS les secteurs
✅ **Précision:** Règles métier optimisées par domaine
✅ **Moins de faux négatifs:** Candidats qualifiés mieux reconnus
✅ **Extensible:** Ajout facile de nouveaux domaines
✅ **Transparent:** Logs de détection pour debugging
✅ **Déterministe:** Résultats reproductibles et auditables

---

## Ajouter un nouveau domaine

Pour ajouter un domaine (ex: "Legal"):

```typescript
// Dans lib/cv-analysis/deterministic-evaluator.ts

legal: {
  keywords: ['avocat', 'juriste', 'legal counsel', 'droit'],
  relevanceRules: {
    direct: ['avocat', 'juriste', 'legal counsel', 'directeur juridique'],
    adjacent: ['paralegal', 'assistant juridique', 'compliance'],
    peripheral: ['droit', 'juridique', 'contentieux', 'contrats']
  },
  skillsRequired: ['droit des contrats', 'contentieux', 'droit social'],
  niceToHave: ['droit fiscal', 'mergers & acquisitions', 'due diligence'],
  skillsMap: {
    'droit': ['law', 'legal', 'juridique'],
    'contentieux': ['litigation', 'procès']
  },
  mustHaveTemplate: 'Au moins 24 mois d\'expérience juridique + diplôme',
  yearsFullScore: 3
}
```

---

## Tests recommandés

Pour vérifier le bon fonctionnement:

1. **Projet FLE:** Créer un projet avec "Formateur FLE" → Vérifier logs "Detected: FLE"
2. **Projet Tech:** Créer un projet avec "Développeur React" → Vérifier logs "Detected: TECH"
3. **Projet Finance:** Créer un projet avec "Comptable" → Vérifier logs "Detected: FINANCE"
4. **Projet inconnu:** Créer un projet avec "Manager opérationnel" → Vérifier logs "GENERIC template"

---

## Migration des projets existants

Les projets existants avec `job_spec_config` sauvegardé:
- ✅ Continuent d'utiliser leur config sauvegardée
- ✅ Pas de changement de comportement

Les nouveaux projets ou projets sans config:
- ✅ Bénéficient automatiquement de la détection multi-domaines
- ✅ Scoring plus précis avec règles métier adaptées

---

## Support & Documentation

- **Code source:** `lib/cv-analysis/deterministic-evaluator.ts`
- **Templates:** Ligne 259-507 (DOMAIN_TEMPLATES)
- **Détection:** Ligne 512-536 (detectJobDomain)
- **Génération JobSpec:** Ligne 541-597 (createDefaultJobSpec)

Pour toute question ou ajout de domaine, consulter le code ou contacter l'équipe technique.
