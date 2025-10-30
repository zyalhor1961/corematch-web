import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

const portalSchema = z.object({
  orgId: z.string().uuid(),
  returnUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin();

    const body = await request.json();
    const { orgId, returnUrl } = portalSchema.parse(body);

    // Get organization with Stripe customer ID
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, stripe_customer_id')
      .eq('id', orgId)
      .single();

    if (orgError || !org || !org.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Organization not found or no billing account' },
        { status: 404 }
      );
    }

    // Create Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/org/${orgId}/billing`,
    });

    return NextResponse.json({
      success: true,
      data: {
        url: session.url,
      },
    });

  } catch (error) {
    console.error('Billing portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}