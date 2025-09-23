'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function DebugPage() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [fixResult, setFixResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    checkUserInfo();
  }, []);

  const checkUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Get organizations
        const { data: orgs } = await supabase
          .from('my_orgs')
          .select('*');

        setUserInfo({
          user: {
            id: user.id,
            email: user.email
          },
          organizations: orgs || []
        });
      }
    } catch (error) {
      setUserInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const testCreateProject = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTestResult({ error: 'Not authenticated' });
        return;
      }

      // Test API call
      const response = await fetch('/api/cv/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          orgId: userInfo?.organizations?.[0]?.id || 'test-org-id',
          name: 'Test Project',
          description: 'Test description',
          job_title: 'Test Job',
          requirements: 'Test requirements'
        })
      });

      const result = await response.json();
      setTestResult({
        status: response.status,
        result: result
      });

    } catch (error) {
      setTestResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const fixOrganization = async () => {
    setFixing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setFixResult({ error: 'Not authenticated' });
        return;
      }

      const response = await fetch('/api/debug/fix-organization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();
      setFixResult({
        status: response.status,
        result: result
      });

      // Refresh user info after fix
      if (response.ok) {
        await checkUserInfo();
      }

    } catch (error) {
      setFixResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Debug CoreMatch</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">User Information</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(userInfo, null, 2)}
          </pre>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Fix Organization Issue</h2>
          <button
            onClick={fixOrganization}
            disabled={fixing}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 mr-4"
          >
            {fixing ? 'Fixing...' : 'Fix Organization Problem'}
          </button>
          
          {fixResult && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Fix Result:</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(fixResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Create Project</h2>
          <button
            onClick={testCreateProject}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Create Project API'}
          </button>
          
          {testResult && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">API Test Result:</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}