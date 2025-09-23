'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Loader2, User, Key } from 'lucide-react';

export default function AdminLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleQuickLogin = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/quick-login', {
        method: 'POST'
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        // Redirect to CV page after successful login
        setTimeout(() => {
          window.location.href = '/org/00000000-0000-0000-0000-000000000001/cv';
        }, 1000);
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Test Login</h1>
          <p className="text-gray-600">Connexion rapide pour tester les fonctionnalités</p>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
              <User className="w-4 h-4 mr-2" />
              Identifiants de test
            </h3>
            <div className="text-sm text-blue-800 space-y-1">
              <div><strong>Email:</strong> admin@corematch.test</div>
              <div><strong>Mot de passe:</strong> AdminTest123!</div>
            </div>
          </div>

          <Button
            onClick={handleQuickLogin}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connexion en cours...
              </>
            ) : (
              <>
                <Key className="w-4 h-4 mr-2" />
                Connexion rapide
              </>
            )}
          </Button>

          {result && (
            <div className={`p-4 rounded-lg ${
              result.success
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <div className="font-semibold mb-1">
                {result.success ? '✅ Connexion réussie!' : '❌ Erreur de connexion'}
              </div>
              <div className="text-sm">
                {result.success
                  ? 'Redirection vers l\'interface CV...'
                  : `Erreur: ${result.error}`
                }
              </div>
            </div>
          )}

          <div className="text-center text-sm text-gray-500">
            <p>Ou connectez-vous manuellement avec les identifiants ci-dessus</p>
            <a href="/login" className="text-blue-600 hover:text-blue-700 underline">
              Page de connexion normale
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}