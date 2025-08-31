import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_PLANS } from '@/lib/stripe/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

const checkoutSchema = z.object({
  orgId: z.string().uuid(),
  plan: z.enum(['starter', 'pro', 'scale']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, plan, successUrl, cancelUrl } = checkoutSchema.parse(body);

    // Verify organization exists and user has access
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, stripe_customer_id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    let customerId = org.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: {
          org_id: orgId,
        },
      });
      
      customerId = customer.id;

      // Update organization with Stripe customer ID
      await supabaseAdmin
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', orgId);
    }

    // Create Checkout Session
    const planConfig = STRIPE_PLANS[plan];
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: planConfig.price,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/org/${orgId}/billing?success=true`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/org/${orgId}/billing?canceled=true`,
      metadata: {
        org_id: orgId,
        plan: plan,
      },
      subscription_data: {
        metadata: {
          org_id: orgId,
          plan: plan,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        url: session.url,
        sessionId: session.id,
      },
    });

  } catch (error) {
    console.error('Billing checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}