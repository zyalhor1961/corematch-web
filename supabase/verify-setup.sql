-- Script de vérification finale de l'installation CoreMatch

-- 1. Vérifier que toutes les tables sont créées
SELECT '=== TABLES ===' as section;
SELECT table_name, 
       CASE 
         WHEN table_name IS NOT NULL THEN '✓ OK'
         ELSE '✗ Manquante'
       END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'startups', 'investors', 'matches', 'messages', 'swipes', 'notifications', 'saved_profiles')
ORDER BY table_name;

-- 2. Vérifier que RLS est activé
SELECT '=== ROW LEVEL SECURITY ===' as section;
SELECT tablename, 
       CASE 
         WHEN rowsecurity THEN '✓ Activé'
         ELSE '✗ Désactivé'
       END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'startups', 'investors', 'matches', 'messages', 'swipes', 'notifications', 'saved_profiles')
ORDER BY tablename;

-- 3. Vérifier les politiques RLS
SELECT '=== POLITIQUES RLS ===' as section;
SELECT schemaname, tablename, policyname, 
       CASE 
         WHEN policyname IS NOT NULL THEN '✓ OK'
         ELSE '✗ Manquante'
       END as status
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Vérifier les fonctions
SELECT '=== FONCTIONS ===' as section;
SELECT routine_name,
       CASE 
         WHEN routine_name IS NOT NULL THEN '✓ OK'
         ELSE '✗ Manquante'
       END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('handle_updated_at', 'handle_new_user', 'calculate_match_score', 
                     'get_potential_matches', 'handle_swipe', 'get_user_matches', 'get_user_analytics')
ORDER BY routine_name;

-- 5. Vérifier les triggers
SELECT '=== TRIGGERS ===' as section;
SELECT trigger_name, event_object_table,
       CASE 
         WHEN trigger_name IS NOT NULL THEN '✓ OK'
         ELSE '✗ Manquant'
       END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 6. Vérifier les index
SELECT '=== INDEX ===' as section;
SELECT indexname,
       CASE 
         WHEN indexname IS NOT NULL THEN '✓ OK'
         ELSE '✗ Manquant'
       END as status
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- 7. Test de création d'un profil test (optionnel)
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Créer un utilisateur test si auth.users le permet
    test_user_id := gen_random_uuid();
    
    -- Insérer un profil test
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (test_user_id, 'test@corematch.com', 'Test User', 'startup')
    ON CONFLICT (id) DO NOTHING;
    
    -- Vérifier que le profil existe
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = test_user_id) THEN
        RAISE NOTICE '✓ Test d''insertion réussi';
        -- Nettoyer
        DELETE FROM public.profiles WHERE id = test_user_id;
        RAISE NOTICE '✓ Test de suppression réussi';
    ELSE
        RAISE NOTICE '✗ Test d''insertion échoué';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '✗ Erreur lors du test: %', SQLERRM;
END $$;

-- 8. Résumé
SELECT '=== RÉSUMÉ ===' as section;
SELECT 
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('profiles', 'startups', 'investors', 'matches', 'messages', 'swipes', 'notifications', 'saved_profiles')) as tables_count,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as policies_count,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public') as functions_count,
    (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public') as triggers_count,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%') as indexes_count;