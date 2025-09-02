-- Script de diagnostic simplifié sans utiliser les colonnes inexistantes

-- 1. Vérifier l'utilisateur actuellement connecté
SELECT '=== UTILISATEUR ACTUEL ===' as section;
SELECT 
  'auth.uid() = ' || COALESCE(auth.uid()::text, 'NULL') as current_user,
  'User exists in auth.users: ' || CASE 
    WHEN EXISTS(SELECT 1 FROM auth.users WHERE id = auth.uid()) THEN 'YES' 
    ELSE 'NO' 
  END as user_in_auth;

-- 2. Voir exactement les colonnes de la table profiles
SELECT '=== COLONNES DANS PROFILES ===' as section;
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 3. Voir les profils utilisateurs (seulement les colonnes de base)
SELECT '=== PROFILS UTILISATEURS ===' as section;
SELECT id, email, created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 5;

-- 4. Voir toutes les organisations dans la base
SELECT '=== TOUTES LES ORGANISATIONS ===' as section;
SELECT 
  id,
  name,
  admin_user_id,
  created_at,
  'admin_user_id = auth.uid(): ' || CASE 
    WHEN admin_user_id = auth.uid() THEN 'YES' 
    ELSE 'NO (' || COALESCE(admin_user_id::text, 'NULL') || ')' 
  END as is_current_user_admin
FROM public.organizations
ORDER BY created_at DESC;

-- 5. Tester la vue my_orgs directement
SELECT '=== TEST VUE MY_ORGS ===' as section;
SELECT * FROM public.my_orgs;

-- 6. Test simple : comparer auth.uid() avec admin_user_id
SELECT '=== COMPARAISON DIRECTE ===' as section;
SELECT 
  auth.uid() as current_auth_uid,
  o.admin_user_id,
  (auth.uid() = o.admin_user_id) as should_match,
  o.name as org_name
FROM public.organizations o
ORDER BY o.created_at DESC;

-- 7. Vérifier si le problème vient des politiques RLS
SELECT '=== TEST SANS RLS ===' as section;
-- Temporairement désactiver RLS pour tester
SET row_security = off;
SELECT COUNT(*) as total_orgs_without_rls FROM public.organizations;
SET row_security = on;

-- 8. Test de création d'organisation simple
DO $$
DECLARE
  current_user_id UUID;
  test_result JSON;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'ERREUR: Aucun utilisateur authentifié';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Utilisateur connecté: %', current_user_id;
  
  -- Tester la fonction de création d'organisation
  SELECT public.create_organization_with_admin('Test Org Debug') INTO test_result;
  RAISE NOTICE 'Résultat création org: %', test_result;
  
  -- Nettoyer
  DELETE FROM public.organizations WHERE name = 'Test Org Debug';
  RAISE NOTICE 'Organisation de test supprimée';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur: %', SQLERRM;
END $$;

-- 9. Vérifier l'email de l'utilisateur connecté vs organisations
SELECT '=== VERIFICATION EMAIL ===' as section;
SELECT 
  p.email as user_email,
  auth.uid() as user_id,
  COUNT(o.id) as org_count_for_this_user
FROM public.profiles p
LEFT JOIN public.organizations o ON o.admin_user_id = p.id
WHERE p.id = auth.uid()
GROUP BY p.email, p.id;