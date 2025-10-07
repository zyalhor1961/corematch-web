import { createSupabaseServerClient } from '@/lib/supabase/server';

export type MembershipRole = 'org_admin' | 'org_manager' | 'org_viewer';

export type MembershipResult =
  | { userId: string; role: MembershipRole }
  | { error: string; status: number };

export async function requireOrgMembership(orgId: string, allowedRoles?: MembershipRole[]): Promise<MembershipResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Utilisateur non authentifie', status: 401 };
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError) {
    console.error('Membership lookup error', membershipError);
    return { error: 'Impossible de verifier les droits', status: 500 };
  }

  if (!membership) {
    return { error: 'Acces interdit pour cette organisation', status: 403 };
  }

  const role = membership.role as MembershipRole;

  if (allowedRoles && !allowedRoles.includes(role)) {
    return { error: 'Permissions insuffisantes', status: 403 };
  }

  return { userId: user.id, role };
}
