-- Fonctions nécessaires pour l'onboarding CoreMatch

-- Table organizations si elle n'existe pas déjà
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  website TEXT,
  logo_url TEXT,
  admin_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Table organization_members pour gérer les invitations
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('admin', 'member', 'viewer')) DEFAULT 'member',
  invited_by UUID REFERENCES public.profiles(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  joined_at TIMESTAMP WITH TIME ZONE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'accepted',
  UNIQUE(organization_id, user_id)
);

-- Table organization_invitations pour gérer les invitations par email
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES public.profiles(id),
  role TEXT CHECK (role IN ('admin', 'member', 'viewer')) DEFAULT 'member',
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64'),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(organization_id, email)
);

-- Activer RLS sur les nouvelles tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour organizations
CREATE POLICY "organizations_select_policy"
  ON public.organizations FOR SELECT
  USING (
    admin_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
      AND status = 'accepted'
    )
  );

CREATE POLICY "organizations_insert_policy"
  ON public.organizations FOR INSERT
  WITH CHECK (admin_user_id = auth.uid());

CREATE POLICY "organizations_update_policy"
  ON public.organizations FOR UPDATE
  USING (
    admin_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'accepted'
    )
  );

-- Politiques RLS pour organization_members
CREATE POLICY "organization_members_select_policy"
  ON public.organization_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = organization_id
      AND admin_user_id = auth.uid()
    )
  );

-- Politiques RLS pour organization_invitations
CREATE POLICY "organization_invitations_select_policy"
  ON public.organization_invitations FOR SELECT
  USING (
    invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = organization_id
      AND admin_user_id = auth.uid()
    )
  );

-- Fonction principale pour créer une organisation avec admin
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
  org_name TEXT,
  org_description TEXT DEFAULT NULL,
  org_website TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  new_org_id UUID;
  current_user_id UUID;
  result JSON;
BEGIN
  -- Récupérer l'ID de l'utilisateur actuel
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
  VALUES (new_org_id, current_user_id, 'admin', 'accepted', NOW());
  
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

-- Fonction pour inviter des utilisateurs par email
CREATE OR REPLACE FUNCTION public.invite_user_to_organization(
  org_id UUID,
  user_email TEXT,
  user_role TEXT DEFAULT 'member'
)
RETURNS JSON AS $$
DECLARE
  current_user_id UUID;
  existing_user_id UUID;
  result JSON;
BEGIN
  current_user_id := auth.uid();
  
  -- Vérifier que l'utilisateur peut inviter dans cette organisation
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
  
  -- Vérifier si l'utilisateur existe déjà
  SELECT id INTO existing_user_id
  FROM public.profiles
  WHERE email = user_email;
  
  IF existing_user_id IS NOT NULL THEN
    -- L'utilisateur existe, l'ajouter directement comme membre
    INSERT INTO public.organization_members (organization_id, user_id, role, invited_by, status)
    VALUES (org_id, existing_user_id, user_role, current_user_id, 'pending')
    ON CONFLICT (organization_id, user_id) 
    DO UPDATE SET 
      role = user_role,
      invited_by = current_user_id,
      status = 'pending';
    
    RETURN json_build_object(
      'success', true,
      'message', 'User added to organization',
      'user_exists', true
    );
  ELSE
    -- L'utilisateur n'existe pas, créer une invitation
    INSERT INTO public.organization_invitations (organization_id, email, role, invited_by)
    VALUES (org_id, user_email, user_role, current_user_id)
    ON CONFLICT (organization_id, email)
    DO UPDATE SET
      role = user_role,
      invited_by = current_user_id,
      status = 'pending',
      expires_at = NOW() + INTERVAL '7 days';
    
    RETURN json_build_object(
      'success', true,
      'message', 'Invitation sent',
      'user_exists', false
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

-- Fonction pour finaliser l'onboarding
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  org_name TEXT,
  org_description TEXT DEFAULT NULL,
  user_role TEXT DEFAULT 'startup',
  selected_modules TEXT[] DEFAULT ARRAY[]::TEXT[],
  team_emails TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSON AS $$
DECLARE
  current_user_id UUID;
  new_org_id UUID;
  org_result JSON;
  email_item TEXT;
  invite_result JSON;
  results JSON[] := ARRAY[]::JSON[];
BEGIN
  current_user_id := auth.uid();
  
  -- Créer l'organisation
  SELECT public.create_organization_with_admin(org_name, org_description) INTO org_result;
  
  IF NOT (org_result->>'success')::BOOLEAN THEN
    RETURN org_result;
  END IF;
  
  new_org_id := (org_result->>'organization_id')::UUID;
  
  -- Mettre à jour le rôle de l'utilisateur
  UPDATE public.profiles 
  SET role = user_role,
      company_name = org_name
  WHERE id = current_user_id;
  
  -- Inviter les membres de l'équipe
  IF array_length(team_emails, 1) > 0 THEN
    FOREACH email_item IN ARRAY team_emails
    LOOP
      IF email_item IS NOT NULL AND email_item != '' THEN
        SELECT public.invite_user_to_organization(new_org_id, email_item, 'member') INTO invite_result;
        results := results || invite_result;
      END IF;
    END LOOP;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'organization_id', new_org_id,
    'organization_name', org_name,
    'user_role', user_role,
    'invitations', results,
    'message', 'Onboarding completed successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_organizations_admin_user_id ON public.organizations(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_id ON public.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_email ON public.organization_invitations(email);

-- Vérification finale
SELECT 'Fonctions d''onboarding créées avec succès!' as message;