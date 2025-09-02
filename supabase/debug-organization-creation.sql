-- Script de diagnostic pour comprendre pourquoi aucune organisation n'est trouvée

-- 1. Vérifier l'utilisateur actuellement connecté
SELECT '=== UTILISATEUR ACTUEL ===' as section;
SELECT 
  'auth.uid() = ' || COALESCE(auth.uid()::text, 'NULL') as current_user,
  'User exists in auth.users: ' || CASE 
    WHEN EXISTS(SELECT 1 FROM auth.users WHERE id = auth.uid()) THEN 'YES' 
    ELSE 'NO' 
  END as user_in_auth;

-- 2. Voir toutes les organisations dans la base
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

-- 3. Voir les profils utilisateurs
SELECT '=== PROFILS UTILISATEURS ===' as section;
SELECT id, email, company_name, role, created_at
FROM public.profiles
ORDER BY created_at DESC;

-- 4. Tester la vue my_orgs directement
SELECT '=== TEST VUE MY_ORGS ===' as section;
SELECT * FROM public.my_orgs;

-- 5. Tester la fonction get_my_organizations
SELECT '=== TEST FONCTION GET_MY_ORGANIZATIONS ===' as section;
SELECT * FROM public.get_my_organizations();

-- 6. Vérifier les politiques RLS sur organizations
SELECT '=== POLITIQUES RLS ORGANIZATIONS ===' as section;
SELECT policyname, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'organizations';

-- 7. Test manuel : essayer de créer une organisation pour l'utilisateur actuel
DO $$
DECLARE
  current_user_id UUID;
  test_org_id UUID;
  org_exists BOOLEAN;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'PROBLÈME: Aucun utilisateur authentifié (auth.uid() est NULL)';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Utilisateur actuel: %', current_user_id;
  
  -- Vérifier si une organisation existe déjà pour cet utilisateur
  SELECT EXISTS(
    SELECT 1 FROM public.organizations 
    WHERE admin_user_id = current_user_id
  ) INTO org_exists;
  
  IF org_exists THEN
    RAISE NOTICE '✓ Une organisation existe déjà pour cet utilisateur';
    SELECT id INTO test_org_id 
    FROM public.organizations 
    WHERE admin_user_id = current_user_id 
    LIMIT 1;
    RAISE NOTICE 'ID de l''organisation: %', test_org_id;
  ELSE
    RAISE NOTICE '✗ Aucune organisation trouvée pour cet utilisateur';
    
    -- Essayer de créer une organisation de test
    BEGIN
      INSERT INTO public.organizations (name, admin_user_id)
      VALUES ('Test Organization', current_user_id)
      RETURNING id INTO test_org_id;
      
      RAISE NOTICE '✓ Organisation de test créée avec ID: %', test_org_id;
      
      -- Supprimer l'organisation de test
      DELETE FROM public.organizations WHERE id = test_org_id;
      RAISE NOTICE '✓ Organisation de test supprimée';
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '✗ Erreur lors de la création d''organisation de test: %', SQLERRM;
    END;
  END IF;
END $$;

-- 8. Vérifier si le profil utilisateur existe
SELECT '=== VÉRIFICATION PROFIL UTILISATEUR ===' as section;
SELECT 
  CASE 
    WHEN auth.uid() IS NULL THEN 'Aucun utilisateur connecté'
    WHEN EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid()) THEN 'Profil utilisateur existe'
    ELSE 'Profil utilisateur MANQUANT pour auth.uid(): ' || auth.uid()::text
  END as profile_status;

-- 9. Test final de la requête exacte de l'application
SELECT '=== TEST REQUÊTE EXACTE APP ===' as section;
SELECT *
FROM public.my_orgs
ORDER BY org_name ASC;