import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing env.STRIPE_SECRET_KEY');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

export const STRIPE_PLANS = {
  starter: {
    price: 'price_starter_monthly', // Replace with actual Stripe price ID
    amount: 4900, // €49 in cents
    name: 'Starter',
    cv_monthly_quota: 200,
    deb_pages_quota: 200,
    multi_entities: false
  },
  pro: {
    price: 'price_pro_monthly',
    amount: 14900, // €149 in cents
    name: 'Pro',
    cv_monthly_quota: 1000,
    deb_pages_quota: 1500,
    multi_entities: false
  },
  scale: {
    price: 'price_scale_monthly',
    amount: 39900, // €399 in cents
    name: 'Scale',
    cv_monthly_quota: 999999,
    deb_pages_quota: 10000,
    multi_entities: true
  }
} as const;

export type StripePlan = keyof typeof STRIPE_PLANS;