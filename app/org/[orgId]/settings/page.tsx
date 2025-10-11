'use client';

import { useParams } from 'next/navigation';
import { useTheme } from '@/app/components/ThemeProvider';
import { Settings, Building2, Users, Bell, Shield, CreditCard } from 'lucide-react';

export default function OrganizationSettingsPage() {
  const params = useParams();
  const { isDarkMode } = useTheme();
  const orgId = params?.orgId as string;

  const settingsSections = [
    {
      icon: Building2,
      title: 'Informations de l\'organisation',
      description: 'Nom, logo, et détails de l\'entreprise',
      status: 'À venir'
    },
    {
      icon: Users,
      title: 'Gestion des membres',
      description: 'Inviter et gérer les membres de l\'équipe',
      status: 'À venir'
    },
    {
      icon: Bell,
      title: 'Notifications',
      description: 'Préférences de notifications par email et push',
      status: 'À venir'
    },
    {
      icon: Shield,
      title: 'Sécurité & Confidentialité',
      description: 'Authentification à deux facteurs et permissions',
      status: 'À venir'
    },
    {
      icon: CreditCard,
      title: 'Facturation & Abonnement',
      description: 'Gérer votre plan et méthodes de paiement',
      status: 'À venir'
    }
  ];

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className={`w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Paramètres
            </h1>
          </div>
          <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Gérer les paramètres de votre organisation
          </p>
        </div>

        {/* Settings Grid */}
        <div className="grid gap-4">
          {settingsSections.map((section, index) => {
            const Icon = section.icon;
            return (
              <div
                key={index}
                className={`p-6 rounded-lg border ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                } transition-colors cursor-not-allowed opacity-75`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-6 h-6 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`text-lg font-semibold ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {section.title}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isDarkMode
                          ? 'bg-yellow-900 text-yellow-300'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {section.status}
                      </span>
                    </div>
                    <p className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {section.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Coming Soon Notice */}
        <div className={`mt-8 p-6 rounded-lg border-2 border-dashed ${
          isDarkMode
            ? 'bg-gray-800 border-gray-700'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="text-center">
            <Settings className={`w-12 h-12 mx-auto mb-3 ${
              isDarkMode ? 'text-blue-400' : 'text-blue-600'
            }`} />
            <h3 className={`text-lg font-semibold mb-2 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Fonctionnalités en cours de développement
            </h3>
            <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Les paramètres d'organisation seront bientôt disponibles.
              Vous pourrez gérer votre équipe, personnaliser votre espace et configurer vos préférences.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
