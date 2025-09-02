-- Voir les informations d'authentification et d'organisation

-- 1. Vérifier votre utilisateur actuel
SELECT '=== MON COMPTE ACTUEL ===' as section;
SELECT 
    auth.uid() as my_user_id,
    'Utilisateur connecté actuellement' as status;

-- 2. Voir votre email dans les profils
SELECT '=== MON EMAIL ===' as section;
SELECT 
    p.id,
    p.email,
    'C''est votre email de connexion' as info
FROM public.profiles p
WHERE p.id = auth.uid();

-- 3. Vérifier l'email dans auth.users aussi
SELECT '=== EMAIL DANS AUTH.USERS ===' as section;
SELECT 
    au.id,
    au.email,
    au.email_confirmed_at,
    au.created_at,
    CASE 
        WHEN au.email_confirmed_at IS NOT NULL THEN 'Email confirmé ✓'
        ELSE 'Email non confirmé ✗'
    END as email_status
FROM auth.users au
WHERE au.id = auth.uid();

-- 4. Voir votre organisation
SELECT '=== MON ORGANISATION ===' as section;
SELECT 
    o.id,
    o.name,
    o.admin_user_id,
    'Vous êtes admin de cette organisation' as role
FROM public.organizations o
WHERE o.admin_user_id = auth.uid();

-- 5. Vérifier si vous avez des sessions actives
SELECT '=== INFORMATION DE CONNEXION ===' as section;
SELECT 
    'Vous êtes actuellement connecté avec l''email ci-dessus' as connexion_info,
    'Utilisez cet email + votre mot de passe pour vous reconnecter' as instruction;