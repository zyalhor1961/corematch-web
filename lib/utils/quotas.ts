import { supabaseAdmin } from '@/lib/supabase/server';
import { PlanQuota } from '@/lib/types';

export const PLAN_QUOTAS: Record<string, PlanQuota> = {
  starter: {
    cv_monthly_quota: 200,
    deb_pages_quota: 200,
    multi_entities: false
  },
  pro: {
    cv_monthly_quota: 1000,
    deb_pages_quota: 1500,
    multi_entities: false
  },
  scale: {
    cv_monthly_quota: 999999,
    deb_pages_quota: 10000,
    multi_entities: true
  },
  trial: {
    cv_monthly_quota: 50,
    deb_pages_quota: 50,
    multi_entities: false
  }
};

export async function checkQuota(
  orgId: string, 
  feature: 'cv' | 'deb', 
  quantity: number = 1
): Promise<{ canUse: boolean; remaining: number; quota: number }> {
  try {
    const { data: result, error } = await supabaseAdmin.rpc('can_use_feature', {
      org_uuid: orgId,
      feature,
      quantity
    });

    if (error) {
      throw error;
    }

    // Get org plan and current usage
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('plan, status')
      .eq('id', orgId)
      .single();

    if (!org) {
      throw new Error('Organization not found');
    }

    const plan = org.status === 'trial' ? 'trial' : org.plan;
    const quota = PLAN_QUOTAS[plan] || PLAN_QUOTAS.trial;
    const maxQuota = feature === 'cv' ? quota.cv_monthly_quota : quota.deb_pages_quota;

    // Get current usage
    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { data: usage } = await supabaseAdmin
      .from('usage_counters')
      .select('cv_count, deb_pages_count')
      .eq('org_id', orgId)
      .eq('period_month', currentPeriod)
      .single();

    const currentUsage = usage 
      ? (feature === 'cv' ? usage.cv_count : usage.deb_pages_count) 
      : 0;

    const remaining = Math.max(0, maxQuota - currentUsage);

    return {
      canUse: result === true,
      remaining,
      quota: maxQuota
    };

  } catch (error) {
    console.error('Error checking quota:', error);
    return {
      canUse: false,
      remaining: 0,
      quota: 0
    };
  }
}

export async function incrementUsage(
  orgId: string,
  feature: 'cv' | 'deb',
  quantity: number = 1
): Promise<void> {
  try {
    if (feature === 'cv') {
      await supabaseAdmin.rpc('increment_cv_usage', {
        org_uuid: orgId
      });
    } else {
      await supabaseAdmin.rpc('increment_deb_usage', {
        org_uuid: orgId,
        pages_count: quantity
      });
    }
  } catch (error) {
    console.error('Error incrementing usage:', error);
    throw error;
  }
}

export async function getCurrentUsage(orgId: string): Promise<{
  cv_count: number;
  deb_pages_count: number;
  period_month: string;
}> {
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  const { data, error } = await supabaseAdmin
    .from('usage_counters')
    .select('cv_count, deb_pages_count, period_month')
    .eq('org_id', orgId)
    .eq('period_month', currentPeriod)
    .single();

  if (error || !data) {
    return {
      cv_count: 0,
      deb_pages_count: 0,
      period_month: currentPeriod
    };
  }

  return data;
}