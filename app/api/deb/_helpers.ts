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
    console.error('No user session found');
    return { error: 'Utilisateur non authentifie', status: 401 };
  }

  console.log('Checking membership for user:', user.id, 'in org:', orgId);

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError) {
    console.error('Membership lookup error:', membershipError);
    console.error('Query params - orgId:', orgId, 'userId:', user.id);
    return { error: 'Impossible de verifier les droits', status: 500 };
  }

  if (!membership) {
    console.error('No membership found for user:', user.id, 'in org:', orgId);
    return { error: 'Acces interdit pour cette organisation', status: 403 };
  }

  console.log('Membership found:', membership);

  const role = membership.role as MembershipRole;

  if (allowedRoles && !allowedRoles.includes(role)) {
    console.error('User role', role, 'not in allowed roles:', allowedRoles);
    return { error: 'Permissions insuffisantes', status: 403 };
  }

  return { userId: user.id, role };
}
