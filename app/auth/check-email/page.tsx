'use client';

import Link from 'next/link';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Brand */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <span className="text-3xl font-bold text-blue-600">CoreMatch</span>
          </Link>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="rounded-full bg-blue-100 p-4">
              <Mail className="h-12 w-12 text-blue-600" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Vérifiez votre email
            </h2>
            <p className="mt-3 text-base text-gray-600">
              Un lien de confirmation a été envoyé à votre adresse email.
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-gray-700 space-y-2">
              <span className="block font-medium text-blue-900">
                📧 Prochaines étapes :
              </span>
              <span className="block text-gray-700">
                1. Ouvrez votre boîte email
              </span>
              <span className="block text-gray-700">
                2. Cliquez sur le lien de confirmation dans l'email
              </span>
              <span className="block text-gray-700">
                3. Vous serez redirigé pour compléter votre inscription
              </span>
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              <span className="font-medium">💡 Astuce :</span> Si vous ne voyez pas l'email, vérifiez votre dossier spam ou courrier indésirable.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full" size="lg">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour à la connexion
              </Button>
            </Link>

            <p className="text-center text-sm text-gray-500">
              Besoin d'aide ?{' '}
              <a href="mailto:support@corematch.fr" className="text-blue-600 hover:text-blue-500 font-medium">
                Contactez le support
              </a>
            </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center text-xs text-gray-500">
          <p>
            L'email de confirmation est valable pendant 24 heures.
          </p>
        </div>
      </div>
    </div>
  );
}
