import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing Stripe signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`Received webhook event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.org_id;
  const plan = session.metadata?.plan;

  if (!orgId || !plan) {
    console.error('Missing metadata in checkout session');
    return;
  }

  try {
    // Update organization status and plan
    await supabaseAdmin
      .from('organizations')
      .update({
        plan,
        status: 'active',
      })
      .eq('id', orgId);

    // Create subscription record if subscription ID is available
    if (session.subscription) {
      await supabaseAdmin
        .from('subscriptions')
        .upsert({
          org_id: orgId,
          stripe_subscription_id: session.subscription as string,
          plan,
          status: 'active',
        });
    }

    console.log(`Checkout completed for org ${orgId}, plan ${plan}`);
  } catch (error) {
    console.error('Error handling checkout completion:', error);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  
  if (!subscriptionId) return;

  try {
    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const orgId = subscription.metadata?.org_id;

    if (!orgId) {
      console.error('No org_id in subscription metadata');
      return;
    }

    // Update organization and subscription status
    await supabaseAdmin
      .from('organizations')
      .update({ status: 'active' })
      .eq('id', orgId);

    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      .eq('stripe_subscription_id', subscriptionId);

    console.log(`Payment succeeded for org ${orgId}`);
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;
  
  if (!subscriptionId) return;

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const orgId = subscription.metadata?.org_id;

    if (!orgId) return;

    // Update organization status to past_due
    await supabaseAdmin
      .from('organizations')
      .update({ status: 'past_due' })
      .eq('id', orgId);

    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'past_due' })
      .eq('stripe_subscription_id', subscriptionId);

    console.log(`Payment failed for org ${orgId}`);
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const orgId = subscription.metadata?.org_id;
  
  if (!orgId) return;

  try {
    // Determine plan from subscription items
    const priceId = subscription.items.data[0]?.price.id;
    let plan = 'starter';
    
    // Map price ID to plan (you'll need to update these with actual Stripe price IDs)
    for (const [planName, config] of Object.entries(import('@/lib/stripe/server').then(m => m.STRIPE_PLANS))) {
      if (config.price === priceId) {
        plan = planName;
        break;
      }
    }

    await supabaseAdmin
      .from('organizations')
      .update({
        plan,
        status: subscription.status === 'active' ? 'active' : 'past_due',
      })
      .eq('id', orgId);

    await supabaseAdmin
      .from('subscriptions')
      .upsert({
        org_id: orgId,
        stripe_subscription_id: subscription.id,
        plan,
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      });

    console.log(`Subscription updated for org ${orgId}: ${subscription.status}`);
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const orgId = subscription.metadata?.org_id;
  
  if (!orgId) return;

  try {
    await supabaseAdmin
      .from('organizations')
      .update({ status: 'canceled' })
      .eq('id', orgId);

    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('stripe_subscription_id', subscription.id);

    console.log(`Subscription canceled for org ${orgId}`);
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}