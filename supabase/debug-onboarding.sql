-- Script de diagnostic pour l'erreur d'onboarding

-- 1. Vérifier l'utilisateur actuel
SELECT '=== UTILISATEUR AUTH ===' as section;
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'zyalhor1961@gmail.com';

-- 2. Vérifier le profil utilisateur
SELECT '=== PROFIL UTILISATEUR ===' as section;
SELECT * FROM public.profiles 
WHERE email = 'zyalhor1961@gmail.com';

-- 3. Vérifier les politiques RLS sur profiles
SELECT '=== POLITIQUES RLS PROFILES ===' as section;
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'profiles';

-- 4. Tester l'insertion/mise à jour d'un profil
DO $$
DECLARE
    user_id_test UUID;
BEGIN
    -- Récupérer l'ID de l'utilisateur
    SELECT id INTO user_id_test 
    FROM auth.users 
    WHERE email = 'zyalhor1961@gmail.com';
    
    IF user_id_test IS NOT NULL THEN
        -- Essayer de mettre à jour le profil
        UPDATE public.profiles 
        SET 
            company_name = 'Test Company',
            role = 'startup'
        WHERE id = user_id_test;
        
        RAISE NOTICE 'Mise à jour réussie pour user_id: %', user_id_test;
    ELSE
        RAISE NOTICE 'Utilisateur non trouvé';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de la mise à jour: %', SQLERRM;
END $$;

-- 5. Vérifier si des tables sont manquantes pour l'onboarding
SELECT '=== VÉRIFICATION TABLES ONBOARDING ===' as section;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'startups', 'investors');

-- 6. Tester les permissions avec un utilisateur fictif
SET role postgres; -- Pour contourner RLS temporairement
SELECT '=== TEST PERMISSIONS ===' as section;
SELECT 
    'profiles' as table_name,
    has_table_privilege('public.profiles', 'SELECT') as can_select,
    has_table_privilege('public.profiles', 'INSERT') as can_insert,
    has_table_privilege('public.profiles', 'UPDATE') as can_update;
RESET role;