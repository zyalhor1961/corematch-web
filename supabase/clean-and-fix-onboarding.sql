-- Supprimer toutes les versions existantes de create_organization_with_admin
DROP FUNCTION IF EXISTS public.create_organization_with_admin(TEXT);
DROP FUNCTION IF EXISTS public.create_organization_with_admin(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_organization_with_admin(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_organization_with_admin(UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_organization_with_admin(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.complete_onboarding(TEXT, TEXT, TEXT, TEXT[], TEXT[]);

-- Supprimer les autres fonctions pour les recréer proprement
DROP FUNCTION IF EXISTS public.invite_user_to_organization(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.invite_team_members(UUID, TEXT[]);
DROP FUNCTION IF EXISTS public.get_user_organization();

-- Recréer la fonction principale avec la signature attendue par l'app
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
  org_name TEXT
)
RETURNS JSON AS $$
DECLARE
  new_org_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;
  
  -- Créer l'organisation
  INSERT INTO public.organizations (name, admin_user_id)
  VALUES (org_name, current_user_id)
  RETURNING id INTO new_org_id;
  
  -- Ajouter l'utilisateur comme membre admin
  INSERT INTO public.organization_members (organization_id, user_id, role, status, joined_at)
  VALUES (new_org_id, current_user_id, 'admin', 'accepted', NOW())
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  -- Mettre à jour le profil utilisateur
  UPDATE public.profiles 
  SET company_name = org_name
  WHERE id = current_user_id;
  
  RETURN json_build_object(
    'success', true,
    'organization_id', new_org_id,
    'organization_name', org_name,
    'admin_user_id', current_user_id,
    'message', 'Organization created successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'details', 'Error creating organization: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Version avec 2 paramètres si nécessaire
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
  admin_user_id UUID,
  org_name TEXT
)
RETURNS JSON AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Vérifier l'authentification
  IF auth.uid() IS NULL OR auth.uid() != admin_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Authentication failed'
    );
  END IF;
  
  -- Créer l'organisation
  INSERT INTO public.organizations (name, admin_user_id)
  VALUES (org_name, admin_user_id)
  RETURNING id INTO new_org_id;
  
  -- Ajouter l'utilisateur comme membre admin
  INSERT INTO public.organization_members (organization_id, user_id, role, status, joined_at)
  VALUES (new_org_id, admin_user_id, 'admin', 'accepted', NOW())
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  -- Mettre à jour le profil
  UPDATE public.profiles 
  SET company_name = org_name
  WHERE id = admin_user_id;
  
  RETURN json_build_object(
    'success', true,
    'organization_id', new_org_id,
    'organization_name', org_name,
    'admin_user_id', admin_user_id,
    'message', 'Organization created successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour inviter un utilisateur
CREATE OR REPLACE FUNCTION public.invite_user_to_organization(
  organization_id UUID,
  user_email TEXT,
  user_role TEXT DEFAULT 'member'
)
RETURNS JSON AS $$
DECLARE
  current_user_id UUID;
  existing_user_id UUID;
  org_name TEXT;
BEGIN
  current_user_id := auth.uid();
  
  -- Vérifier l'autorisation
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = organization_id
    AND admin_user_id = current_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not authorized to invite users to this organization'
    );
  END IF;
  
  -- Récupérer le nom de l'organisation
  SELECT name INTO org_name FROM public.organizations WHERE id = organization_id;
  
  -- Vérifier si l'utilisateur existe
  SELECT id INTO existing_user_id
  FROM public.profiles
  WHERE email = user_email;
  
  IF existing_user_id IS NOT NULL THEN
    -- Ajouter comme membre
    INSERT INTO public.organization_members (organization_id, user_id, role, invited_by, status)
    VALUES (organization_id, existing_user_id, user_role, current_user_id, 'pending')
    ON CONFLICT (organization_id, user_id) 
    DO UPDATE SET 
      role = user_role,
      invited_by = current_user_id,
      status = 'pending';
      
    RETURN json_build_object(
      'success', true,
      'message', 'User invited to organization',
      'user_exists', true,
      'organization_name', org_name
    );
  ELSE
    -- Créer invitation
    INSERT INTO public.organization_invitations (organization_id, email, role, invited_by)
    VALUES (organization_id, user_email, user_role, current_user_id)
    ON CONFLICT (organization_id, email)
    DO UPDATE SET
      role = user_role,
      invited_by = current_user_id,
      status = 'pending',
      expires_at = NOW() + INTERVAL '7 days';
      
    RETURN json_build_object(
      'success', true,
      'message', 'Invitation sent',
      'user_exists', false,
      'organization_name', org_name
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction principale d'onboarding complet
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  organization_name TEXT,
  organization_description TEXT DEFAULT NULL,
  user_role TEXT DEFAULT 'startup',
  selected_modules TEXT[] DEFAULT ARRAY[]::TEXT[],
  team_emails TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSON AS $$
DECLARE
  current_user_id UUID;
  org_result JSON;
  new_org_id UUID;
  email_item TEXT;
  invite_results JSON[] := ARRAY[]::JSON[];
  invite_result JSON;
  successful_invites INTEGER := 0;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;
  
  -- Créer l'organisation
  SELECT public.create_organization_with_admin(organization_name) INTO org_result;
  
  IF NOT (org_result->>'success')::BOOLEAN THEN
    RETURN org_result;
  END IF;
  
  new_org_id := (org_result->>'organization_id')::UUID;
  
  -- Mettre à jour le profil utilisateur
  UPDATE public.profiles 
  SET 
    role = user_role,
    company_name = organization_name
  WHERE id = current_user_id;
  
  -- Inviter les membres de l'équipe
  IF array_length(team_emails, 1) > 0 THEN
    FOREACH email_item IN ARRAY team_emails
    LOOP
      IF email_item IS NOT NULL AND email_item != '' AND email_item ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        SELECT public.invite_user_to_organization(new_org_id, email_item, 'member') INTO invite_result;
        invite_results := invite_results || invite_result;
        
        IF (invite_result->>'success')::BOOLEAN THEN
          successful_invites := successful_invites + 1;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'organization_id', new_org_id,
    'organization_name', organization_name,
    'user_role', user_role,
    'total_invitations', array_length(team_emails, 1),
    'successful_invitations', successful_invites,
    'invitation_results', invite_results,
    'message', 'Onboarding completed successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Onboarding failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vérification des fonctions créées
SELECT 'Fonctions nettoyées et recréées!' as message;

-- Lister toutes les fonctions d'onboarding
SELECT 
  routine_name,
  array_to_string(ARRAY(
    SELECT parameter_name || ' ' || data_type 
    FROM information_schema.parameters 
    WHERE specific_name = r.specific_name
    ORDER BY ordinal_position
  ), ', ') as parameters
FROM information_schema.routines r
WHERE routine_schema = 'public' 
AND (routine_name LIKE '%organization%' OR routine_name LIKE '%onboarding%')
ORDER BY routine_name;