-- Créer toutes les variantes possibles de create_organization_with_admin
-- pour couvrir les différents appels de l'application

-- Version 1: avec admin_user_id et org_name
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
  admin_user_id UUID,
  org_name TEXT
)
RETURNS JSON AS $$
DECLARE
  new_org_id UUID;
  result JSON;
BEGIN
  -- Vérifier que l'utilisateur est authentifié
  IF auth.uid() IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not authenticated'
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
  
  -- Mettre à jour le profil avec l'organisation
  UPDATE public.profiles 
  SET company_name = org_name
  WHERE id = admin_user_id;
  
  RETURN json_build_object(
    'success', true,
    'organization_id', new_org_id,
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

-- Version 2: avec org_description, org_name, org_website
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
  org_description TEXT,
  org_name TEXT,
  org_website TEXT
)
RETURNS JSON AS $$
DECLARE
  new_org_id UUID;
  current_user_id UUID;
  result JSON;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;
  
  -- Créer l'organisation
  INSERT INTO public.organizations (name, description, website, admin_user_id)
  VALUES (org_name, org_description, org_website, current_user_id)
  RETURNING id INTO new_org_id;
  
  -- Ajouter l'utilisateur comme membre admin
  INSERT INTO public.organization_members (organization_id, user_id, role, status, joined_at)
  VALUES (new_org_id, current_user_id, 'admin', 'accepted', NOW())
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  -- Mettre à jour le profil avec l'organisation
  UPDATE public.profiles 
  SET company_name = org_name
  WHERE id = current_user_id;
  
  RETURN json_build_object(
    'success', true,
    'organization_id', new_org_id,
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

-- Version 3: juste avec org_name (la plus simple)
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
  org_name TEXT
)
RETURNS JSON AS $$
DECLARE
  new_org_id UUID;
  current_user_id UUID;
  result JSON;
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
  
  -- Mettre à jour le profil avec l'organisation
  UPDATE public.profiles 
  SET company_name = org_name
  WHERE id = current_user_id;
  
  RETURN json_build_object(
    'success', true,
    'organization_id', new_org_id,
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

-- Fonction pour inviter plusieurs utilisateurs en une fois
CREATE OR REPLACE FUNCTION public.invite_team_members(
  org_id UUID,
  email_list TEXT[]
)
RETURNS JSON AS $$
DECLARE
  current_user_id UUID;
  email_item TEXT;
  invite_result JSON;
  results JSON[] := ARRAY[]::JSON[];
  success_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  current_user_id := auth.uid();
  
  -- Vérifier l'autorisation
  IF NOT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = org_id
    AND admin_user_id = current_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not authorized to invite users to this organization'
    );
  END IF;
  
  -- Inviter chaque utilisateur
  IF array_length(email_list, 1) > 0 THEN
    FOREACH email_item IN ARRAY email_list
    LOOP
      IF email_item IS NOT NULL AND email_item != '' AND email_item ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        SELECT public.invite_user_to_organization(org_id, email_item, 'member') INTO invite_result;
        results := results || invite_result;
        
        IF (invite_result->>'success')::BOOLEAN THEN
          success_count := success_count + 1;
        ELSE
          error_count := error_count + 1;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'total_invitations', array_length(email_list, 1),
    'successful_invitations', success_count,
    'failed_invitations', error_count,
    'results', results,
    'message', format('Sent %s invitations successfully', success_count)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir l'organisation d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_user_organization()
RETURNS JSON AS $$
DECLARE
  current_user_id UUID;
  org_record RECORD;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;
  
  -- Chercher l'organisation où l'utilisateur est admin
  SELECT o.* INTO org_record
  FROM public.organizations o
  WHERE o.admin_user_id = current_user_id
  LIMIT 1;
  
  IF org_record.id IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'organization', row_to_json(org_record)
    );
  END IF;
  
  -- Chercher l'organisation où l'utilisateur est membre
  SELECT o.* INTO org_record
  FROM public.organizations o
  JOIN public.organization_members om ON om.organization_id = o.id
  WHERE om.user_id = current_user_id
  AND om.status = 'accepted'
  LIMIT 1;
  
  IF org_record.id IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'organization', row_to_json(org_record)
    );
  END IF;
  
  RETURN json_build_object(
    'success', false,
    'error', 'No organization found for user'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vérifier les fonctions créées
SELECT 'Fonctions d''onboarding mises à jour!' as message;
SELECT routine_name, array_to_string(ARRAY(
  SELECT parameter_name || ' ' || data_type 
  FROM information_schema.parameters 
  WHERE specific_name = r.specific_name
  ORDER BY ordinal_position
), ', ') as parameters
FROM information_schema.routines r
WHERE routine_schema = 'public' 
AND routine_name LIKE 'create_organization%'
ORDER BY routine_name;