import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { withOrgAccessFromBody } from '@/lib/api/auth-middleware';
import { z } from 'zod';

const sendInvitationsSchema = z.object({
  orgId: z.string().uuid(),
  emails: z.array(z.string().email()).min(1).max(50), // Max 50 invitations at once
  role: z.enum(['org_viewer', 'org_member', 'org_admin']).optional().default('org_viewer'),
});

/**
 * POST /api/admin/send-invitations
 *
 * Envoie des invitations pour rejoindre une organisation.
 *
 * Sécurité:
 * - Requiert authentification (withOrgAccessFromBody)
 * - Vérifie que l'user est membre de l'org
 * - Utilise supabaseAdmin pour bypass RLS (nécessaire pour INSERT invitations)
 * - Limite 50 invitations maximum par requête
 */
export const POST = withOrgAccessFromBody(async (request, session, orgId, membership) => {
  try {
    const body = (request as any).parsedBody || await request.json();
    const { emails, role } = sendInvitationsSchema.parse(body);

    console.log(`[send-invitations] User ${session.user.id} sending ${emails.length} invitations to org ${orgId}`);

    // Vérifier que l'user a le droit d'inviter (admin ou owner)
    const canInvite = ['admin', 'owner'].includes(membership.role);
    if (!canInvite) {
      return NextResponse.json(
        { error: 'PERMISSION_DENIED', message: 'Only admins and owners can send invitations' },
        { status: 403 }
      );
    }

    // Créer les invitations
    const invitations = emails.map(email => ({
      org_id: orgId,
      invited_email: email.toLowerCase().trim(),
      role: role,
      // TODO: Add invited_by column to track who sent the invitation
      user_id: null, // null jusqu'à ce que l'invitation soit acceptée
    }));

    // Insérer avec supabaseAdmin (bypass RLS)
    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .insert(invitations)
      .select();

    if (error) {
      console.error('[send-invitations] Error inserting invitations:', error);

      // Gérer erreur de duplicate key (invitation déjà existante)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'DUPLICATE_INVITATION', message: 'One or more invitations already exist' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: 'Failed to create invitations', details: error.message },
        { status: 500 }
      );
    }

    console.log(`[send-invitations] Successfully created ${data?.length || 0} invitations`);

    // TODO: Envoyer emails d'invitation (via service email)
    // Pour l'instant, les invitations sont juste créées en DB

    return NextResponse.json({
      success: true,
      invitations: data,
      message: `${data?.length || 0} invitation(s) sent successfully`,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[send-invitations] Unexpected error:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
});
