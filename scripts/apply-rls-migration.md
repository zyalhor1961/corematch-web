# 🔒 Guide d'Application des Politiques RLS (Row Level Security)

Ce guide explique comment appliquer les politiques de sécurité RLS pour protéger toutes les données organisationnelles dans Supabase.

## 📋 Vue d'ensemble

La migration `005_enforce_comprehensive_rls.sql` contient toutes les politiques nécessaires pour :

- ✅ **Isolation multi-tenant** : Chaque organisation ne peut accéder qu'à ses propres données
- ✅ **Contrôle d'accès basé sur les rôles** : `org_admin`, `org_manager`, `org_viewer`
- ✅ **Support du master admin** : L'utilisateur `admin@corematch.test` a accès à tout
- ✅ **Protection en cascade** : Les tables liées héritent des permissions via les relations

## 🎯 Tables Protégées

### Tables avec `org_id` direct :
- `organizations` - Table des organisations
- `organization_members` - Membres des organisations
- `subscriptions` - Abonnements
- `projects` - Projets CV
- `candidates` - Candidats CV
- `documents` - Documents DEB
- `products` - Produits de référence
- `leads` - Prospects commerciaux
- `usage_counters` - Compteurs d'usage

### Tables avec protection en cascade :
- `document_pages` - Pages de documents (via `document_id`)
- `document_lines` - Lignes de documents (via `document_id`)
- `jobs` - Tâches de traitement (via `document_id`)
- `audit_logs` - Logs d'audit (via `document_id`)

## 🚀 Instructions d'Application

### Étape 1 : Connexion à Supabase
1. Aller sur [supabase.com](https://supabase.com)
2. Se connecter au projet CoreMatch
3. Aller dans **SQL Editor**

### Étape 2 : Exécution de la Migration
1. Ouvrir le fichier `supabase/migrations/005_enforce_comprehensive_rls.sql`
2. Copier tout le contenu
3. Coller dans l'éditeur SQL de Supabase
4. Cliquer sur **Run** pour exécuter

### Étape 3 : Validation
Exécuter cette requête pour vérifier que RLS est activé :

```sql
SELECT
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'organizations', 'organization_members', 'subscriptions',
    'projects', 'candidates', 'documents', 'document_pages',
    'document_lines', 'jobs', 'audit_logs', 'products',
    'leads', 'usage_counters'
  )
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
```

**Résultat attendu :** Toutes les tables doivent avoir `rls_enabled = true` et `policy_count > 0`.

## 🔧 Fonctions d'Aide

La migration crée ces fonctions utiles :

### `auth.is_org_member(org_id UUID)`
Vérifie si l'utilisateur actuel est membre de l'organisation.

### `auth.is_org_admin(org_id UUID)`
Vérifie si l'utilisateur actuel est admin de l'organisation.

### `auth.user_organizations()`
Retourne la liste des organisations auxquelles l'utilisateur a accès.

### `auth.validate_rls_security()`
Valide que RLS est correctement configuré sur toutes les tables.

## 🛡️ Politiques de Sécurité

### Niveau Organisation
- **Lecture** : Membres de l'organisation uniquement
- **Modification** : Admins de l'organisation uniquement
- **Master Admin** : Accès complet à toutes les organisations

### Niveau Projet/Document
- **Lecture** : Membres de l'organisation
- **Création** : Membres de l'organisation
- **Modification** : Créateur du projet/document OU admin de l'organisation
- **Suppression** : Admins de l'organisation uniquement

### Niveau Données Liées
- **Accès** : Hérité de la table parent via les relations

## 🧪 Tests de Validation

### Test 1 : Isolation Inter-Organisationnelle
```sql
-- En tant qu'utilisateur de l'org A, ne doit pas voir les données de l'org B
SELECT COUNT(*) FROM projects WHERE org_id != 'MON_ORG_ID';
-- Résultat attendu : 0
```

### Test 2 : Accès Master Admin
```sql
-- En tant qu'admin@corematch.test, doit voir toutes les organisations
SELECT COUNT(*) FROM organizations;
-- Résultat attendu : Toutes les organisations
```

### Test 3 : Permissions de Rôle
```sql
-- En tant qu'org_viewer, ne doit pas pouvoir supprimer
DELETE FROM projects WHERE id = 'TEST_PROJECT_ID';
-- Résultat attendu : Erreur de permission
```

## 🚨 Points d'Attention

### Avant Application
- [ ] **Sauvegarder la base de données**
- [ ] **Tester sur un environnement de développement**
- [ ] **Informer les équipes de l'interruption potentielle**

### Après Application
- [ ] **Valider que toutes les tables ont RLS activé**
- [ ] **Tester l'accès avec différents utilisateurs**
- [ ] **Vérifier que les APIs fonctionnent correctement**
- [ ] **Monitorer les logs d'erreur**

### Rollback si Nécessaire
En cas de problème, désactiver temporairement RLS :

```sql
-- ATTENTION : N'utiliser qu'en cas d'urgence !
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
```

## 📊 Monitoring Post-Migration

### Requêtes Utiles

**Vérifier l'état RLS :**
```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Lister toutes les politiques :**
```sql
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Vérifier les erreurs d'accès :**
```sql
-- Surveiller les logs de l'application pour les erreurs 403/401
```

## ✅ Checklist de Validation

- [ ] Migration appliquée sans erreur
- [ ] RLS activé sur toutes les tables organisationnelles
- [ ] Politiques créées pour chaque table
- [ ] Fonctions d'aide accessibles
- [ ] Master admin peut tout voir
- [ ] Utilisateurs normaux voient uniquement leur organisation
- [ ] APIs fonctionnent correctement
- [ ] Interface utilisateur fonctionne normalement

## 🎉 Résultat Final

Une fois appliquée, cette migration garantit :

- 🔒 **Sécurité maximale** : Impossible d'accéder aux données d'autres organisations
- 🎯 **Granularité** : Permissions précises selon les rôles
- 🚀 **Performance** : Filtrage au niveau base de données
- 🛠️ **Maintenabilité** : Politiques centralisées et documentées
- 📈 **Scalabilité** : Support natif du multi-tenant

**La sécurité des données organisationnelles est maintenant assurée au niveau le plus bas de l'architecture !** 🛡️