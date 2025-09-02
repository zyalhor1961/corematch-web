"use client";

import { useOrganization, useOrgQuery } from '@/hooks/useOrganization';
import { useEffect, useState } from 'react';

export default function OrganizationTest() {
  const { orgId, orgData, loading, error } = useOrganization();
  const { fetchWithOrgId, countWithOrgId, isReady } = useOrgQuery();
  const [testData, setTestData] = useState<any>(null);

  useEffect(() => {
    if (isReady) {
      // Test des appels API
      const testAPIs = async () => {
        try {
          console.log('🧪 Test des APIs avec orgId:', orgId);
          
          // Test usage_counters
          const currentMonth = new Date().toISOString().slice(0, 7);
          const usage = await fetchWithOrgId('usage_counters', {
            filters: { period_month: currentMonth }
          });
          
          // Test projects count
          const projectCount = await countWithOrgId('projects');
          
          // Test documents count
          const docCount = await countWithOrgId('documents');
          
          setTestData({
            usage: usage?.length || 0,
            projects: projectCount,
            documents: docCount
          });
          
          console.log('✅ Tests API réussis:', { usage, projectCount, docCount });
          
        } catch (err) {
          console.error('❌ Erreur test API:', err);
        }
      };
      
      testAPIs();
    }
  }, [isReady, orgId, fetchWithOrgId, countWithOrgId]);

  if (loading) {
    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-800">🔄 Chargement de l'organisation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">❌ Erreur: {error}</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">⚠️ Aucune organisation trouvée</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
      <h3 className="text-lg font-semibold text-green-800 mb-2">
        ✅ Organisation chargée avec succès !
      </h3>
      
      <div className="space-y-2 text-sm text-green-700">
        <p><strong>ID:</strong> {orgId}</p>
        <p><strong>Nom:</strong> {orgData?.org_name}</p>
        <p><strong>Plan:</strong> {orgData?.plan}</p>
        <p><strong>Status:</strong> {orgData?.status}</p>
      </div>
      
      {testData && (
        <div className="mt-4 p-3 bg-white rounded border">
          <h4 className="font-medium text-green-800 mb-2">Test des APIs:</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <p>Usage counters: {testData.usage} records</p>
            <p>Projects: {testData.projects} records</p>
            <p>Documents: {testData.documents} records</p>
          </div>
        </div>
      )}
      
      <div className="mt-4 text-xs text-green-600">
        Plus de problème org_id=undefined ! 🎉
      </div>
    </div>
  );
}