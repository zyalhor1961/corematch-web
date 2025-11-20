'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/app/components/ui/button';
import { Organization, UsageCounter } from '@/lib/types';
import { 
  Calendar, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  ExternalLink
} from 'lucide-react';

export default function BillingPage() {
  const params = useParams();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [usage, setUsage] = useState<UsageCounter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  
  const orgId = params?.orgId as string;

  useEffect(() => {
    if (orgId) {
      loadBillingData();
    }
  }, []);

  const loadBillingData = async () => {
    try {
      // Get organization details
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      // Get subscription
      await supabase
        .from('subscriptions')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get current usage
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: usageData } = await supabase
        .from('usage_counters')
        .select('*')
        .eq('org_id', orgId)
        .eq('period_month', currentMonth)
        .single();

      setOrganization(orgData);
      setUsage(usageData);
    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (plan: string) => {
    setActionLoading('upgrade');
    
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          plan,
          successUrl: `${window.location.origin}/org/${orgId}/billing?success=true`,
          cancelUrl: `${window.location.origin}/org/${orgId}/billing`
        })
      });

      const data = await response.json();
      
      if (data.success && data.data.url) {
        window.location.href = data.data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Erreur lors de la création de la session de paiement');
    } finally {
      setActionLoading('');
    }
  };

  const handleManageBilling = async () => {
    setActionLoading('portal');
    
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          returnUrl: `${window.location.origin}/org/${orgId}/billing`
        })
      });

      const data = await response.json();
      
      if (data.success && data.data.url) {
        window.location.href = data.data.url;
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      alert('Erreur lors de l\'accès au portail de facturation');
    } finally {
      setActionLoading('');
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Actif' },
      trial: { color: 'bg-blue-100 text-blue-800', icon: Calendar, label: 'Essai' },
      past_due: { color: 'bg-red-100 text-red-800', icon: AlertTriangle, label: 'En retard' },
      canceled: { color: 'bg-gray-100 text-gray-800', icon: AlertTriangle, label: 'Annulé' }
    };
    
    const { color, icon: Icon, label } = config[status as keyof typeof config] || config.trial;
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${color}`}>
        <Icon className="w-4 h-4 mr-1" />
        {label}
      </span>
    );
  };

  const getPlanFeatures = (plan: string) => {
    const features = {
      starter: {
        price: '49€/mois',
        cv: '200 CV/mois',
        deb: '200 pages/mois',
        users: '5 utilisateurs',
        support: 'Support email'
      },
      pro: {
        price: '149€/mois',
        cv: '1000 CV/mois',
        deb: '1500 pages/mois',
        users: '15 utilisateurs',
        support: 'Support prioritaire'
      },
      scale: {
        price: '399€/mois',
        cv: 'CV illimités',
        deb: '10000 pages/mois',
        users: 'Utilisateurs illimités',
        support: 'Support téléphone'
      }
    };
    return features[plan as keyof typeof features] || features.starter;
  };

  const getQuotaProgress = (used: number, limit: number) => {
    const percentage = Math.min((used / limit) * 100, 100);
    const isHigh = percentage > 80;
    const isFull = percentage >= 100;
    
    return {
      percentage,
      color: isFull ? 'bg-red-500' : isHigh ? 'bg-orange-500' : 'bg-blue-500',
      textColor: isFull ? 'text-red-700' : isHigh ? 'text-orange-700' : 'text-blue-700'
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const features = getPlanFeatures(organization?.plan || 'starter');
  const quotas = {
    cv: organization?.plan === 'starter' ? 200 : organization?.plan === 'pro' ? 1000 : 999999,
    deb: organization?.plan === 'starter' ? 200 : organization?.plan === 'pro' ? 1500 : 10000
  };
  
  const cvProgress = getQuotaProgress(usage?.cv_count || 0, quotas.cv);
  const debProgress = getQuotaProgress(usage?.deb_pages_count || 0, quotas.deb);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Facturation</h1>
        <p className="text-gray-600">Gérez votre abonnement et consultez votre usage</p>
      </div>

      {/* Current Plan */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Plan actuel</h2>
            <div className="flex items-center mt-2">
              <span className="text-3xl font-bold text-gray-900 capitalize">
                {organization?.plan || 'Starter'}
              </span>
              <span className="ml-3">{getStatusBadge(organization?.status || 'trial')}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{features.price}</p>
            {organization?.status === 'trial' && organization?.trial_end_date && (
              <p className="text-sm text-orange-600">
                Essai jusqu&apos;au {new Date(organization.trial_end_date).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">CV par mois</p>
            <p className="font-semibold text-gray-900">{features.cv}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Pages DEB</p>
            <p className="font-semibold text-gray-900">{features.deb}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Utilisateurs</p>
            <p className="font-semibold text-gray-900">{features.users}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Support</p>
            <p className="font-semibold text-gray-900">{features.support}</p>
          </div>
        </div>

        <div className="flex space-x-3">
          {organization?.plan !== 'scale' && (
            <Button 
              onClick={() => handleUpgrade(organization?.plan === 'starter' ? 'pro' : 'scale')}
              disabled={actionLoading === 'upgrade'}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              {actionLoading === 'upgrade' ? 'Chargement...' : 'Upgrader'}
            </Button>
          )}
          
          {organization?.stripe_customer_id && (
            <Button 
              variant="outline"
              onClick={handleManageBilling}
              disabled={actionLoading === 'portal'}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {actionLoading === 'portal' ? 'Chargement...' : 'Gérer la facturation'}
            </Button>
          )}
        </div>
      </div>

      {/* Usage */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage ce mois-ci</h2>
        
        <div className="space-y-6">
          {/* CV Usage */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">CV analysés</span>
              <span className={`text-sm font-medium ${cvProgress.textColor}`}>
                {usage?.cv_count || 0} / {quotas.cv === 999999 ? '∞' : quotas.cv}
              </span>
            </div>
            {quotas.cv !== 999999 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${cvProgress.color}`}
                  style={{ width: `${cvProgress.percentage}%` }}
                ></div>
              </div>
            )}
          </div>

          {/* DEB Usage */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Pages DEB traitées</span>
              <span className={`text-sm font-medium ${debProgress.textColor}`}>
                {usage?.deb_pages_count || 0} / {quotas.deb}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${debProgress.color}`}
                style={{ width: `${debProgress.percentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {(cvProgress.percentage > 80 || debProgress.percentage > 80) && (
          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
              <p className="text-sm text-orange-700">
                Vous approchez de votre limite mensuelle. 
                {organization?.plan !== 'scale' && (
                  <button 
                    onClick={() => handleUpgrade('pro')}
                    className="ml-1 text-orange-800 underline hover:text-orange-900"
                  >
                    Upgrader maintenant
                  </button>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Options */}
      {organization?.plan !== 'scale' && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Plans disponibles</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {organization?.plan === 'starter' && (
              <div className="border-2 border-blue-500 rounded-lg p-6">
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Pro</h3>
                  <p className="text-3xl font-bold text-blue-600">149€<span className="text-lg text-gray-500">/mois</span></p>
                </div>
                <ul className="space-y-2 mb-6 text-sm text-gray-600">
                  <li>• 1000 CV par mois</li>
                  <li>• 1500 pages DEB</li>
                  <li>• 15 utilisateurs</li>
                  <li>• Support prioritaire</li>
                  <li>• API webhooks</li>
                </ul>
                <Button 
                  onClick={() => handleUpgrade('pro')}
                  disabled={actionLoading === 'upgrade'}
                  className="w-full"
                >
                  Passer au Pro
                </Button>
              </div>
            )}
            
            <div className="border-2 border-purple-500 rounded-lg p-6">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Scale</h3>
                <p className="text-3xl font-bold text-purple-600">399€<span className="text-lg text-gray-500">/mois</span></p>
              </div>
              <ul className="space-y-2 mb-6 text-sm text-gray-600">
                <li>• CV illimités</li>
                <li>• 10000 pages DEB</li>
                <li>• Utilisateurs illimités</li>
                <li>• Support téléphone</li>
                <li>• Multi-entités</li>
                <li>• API complète</li>
              </ul>
              <Button 
                onClick={() => handleUpgrade('scale')}
                disabled={actionLoading === 'upgrade'}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Passer au Scale
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}