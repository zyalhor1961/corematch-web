'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { DocumentUpload } from '@/components/daf/DocumentUpload';
import { DocumentInbox } from '@/components/daf/DocumentInbox';
import { FileText, Upload, List, Sparkles, Shield, Zap } from 'lucide-react';

/**
 * Page de démo DAF Docs Assistant - PREMIUM DESIGN
 *
 * Phase 0: Upload + Classification automatique
 * Phase 1+: Extraction, Validation, Export
 */
export default function DAFDemoPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'upload' | 'inbox'>('upload');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Lire le paramètre tab de l'URL au chargement
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'inbox') {
      setActiveTab('inbox');
    }
  }, [searchParams]);

  const handleUploadComplete = () => {
    // Refresh inbox après upload
    setRefreshTrigger(prev => prev + 1);
    // Switch to inbox tab
    setTimeout(() => setActiveTab('inbox'), 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Premium Header with Gradient */}
      <div className="relative bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 border-b border-slate-800 shadow-2xl">
        {/* Ambient glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-blue-600/20 blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600 blur-xl opacity-50 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-blue-500 to-cyan-600 p-3 rounded-xl shadow-lg">
                  <FileText className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                  DAF Docs Assistant
                </h1>
                <p className="text-sm text-blue-200/80 flex items-center gap-2 mt-1">
                  <Sparkles className="h-3 w-3" />
                  Powered by AI • Ultra-sécurisé • Conforme RGPD
                </p>
              </div>
            </div>

            {/* Trust badges */}
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                <Shield className="h-4 w-4 text-green-400" />
                <span className="text-white/90 font-medium">Certifié sécurisé</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                <Zap className="h-4 w-4 text-amber-400" />
                <span className="text-white/90 font-medium">IA Premium</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Glassmorphism Tabs */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('upload')}
              className={`group relative flex items-center gap-2 px-6 py-4 font-semibold text-sm transition-all duration-300 ${
                activeTab === 'upload'
                  ? 'text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {/* Active indicator */}
              {activeTab === 'upload' && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10 rounded-t-xl border-t-2 border-blue-500"></div>
              )}
              <Upload className={`h-4 w-4 relative z-10 transition-transform duration-300 ${
                activeTab === 'upload' ? 'scale-110' : 'group-hover:scale-105'
              }`} />
              <span className="relative z-10">Upload de documents</span>
            </button>

            <button
              onClick={() => setActiveTab('inbox')}
              className={`group relative flex items-center gap-2 px-6 py-4 font-semibold text-sm transition-all duration-300 ${
                activeTab === 'inbox'
                  ? 'text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {/* Active indicator */}
              {activeTab === 'inbox' && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-500/10 rounded-t-xl border-t-2 border-blue-500"></div>
              )}
              <List className={`h-4 w-4 relative z-10 transition-transform duration-300 ${
                activeTab === 'inbox' ? 'scale-110' : 'group-hover:scale-105'
              }`} />
              <span className="relative z-10">Mes documents</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'upload' && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Uploader vos documents
              </h2>
              <p className="text-sm text-gray-600">
                Glissez-déposez vos factures, relevés bancaires, contrats ou autres documents.
                L'IA les classera automatiquement.
              </p>
            </div>
            <DocumentUpload onUploadComplete={handleUploadComplete} />

            {/* Premium AI Features Card */}
            <div className="mt-8 relative overflow-hidden bg-gradient-to-br from-blue-600 via-cyan-600 to-blue-700 rounded-2xl shadow-2xl">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>

              <div className="relative p-6 text-white">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-6 w-6 text-amber-300 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-lg mb-2">Classification IA ultra-précise</h3>
                    <p className="text-blue-100 text-sm mb-4">
                      Notre IA dernière génération analyse instantanément vos documents et les classe automatiquement
                      avec une précision de 95%+. Fournisseurs, montants, dates : tout est détecté.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">
                        Factures
                      </span>
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">
                        Relevés bancaires
                      </span>
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">
                        Contrats
                      </span>
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">
                        Assurances
                      </span>
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">
                        Notes de frais
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inbox' && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Mes documents
              </h2>
              <p className="text-sm text-gray-600">
                Tous vos documents classés automatiquement
              </p>
            </div>
            <DocumentInbox refreshTrigger={refreshTrigger} />
          </div>
        )}
      </div>

      {/* Premium Roadmap Footer */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl shadow-2xl border border-slate-700">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-cyan-600/10 to-blue-600/10 animate-pulse"></div>

          <div className="relative p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">
                Feuille de route Premium
              </h3>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Phase 1 */}
              <div className="group relative overflow-hidden bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="text-blue-400 font-bold text-sm mb-2">PHASE 1</div>
                  <h4 className="text-white font-bold text-lg mb-3">Extraction automatique</h4>
                  <p className="text-slate-300 text-sm">
                    IA dernière génération pour extraire montants, dates, TVA, numéros de facture avec une précision chirurgicale.
                  </p>
                </div>
              </div>

              {/* Phase 2 */}
              <div className="group relative overflow-hidden bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-full -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="text-cyan-400 font-bold text-sm mb-2">PHASE 2</div>
                  <h4 className="text-white font-bold text-lg mb-3">Validation comptable</h4>
                  <p className="text-slate-300 text-sm">
                    Suggestions PCG automatiques, contrôles TVA/LME, et validation intelligente conforme aux normes françaises.
                  </p>
                </div>
              </div>

              {/* Phase 3 */}
              <div className="group relative overflow-hidden bg-gradient-to-br from-amber-500/20 to-orange-600/20 backdrop-blur-sm rounded-xl p-6 border border-amber-500/30 hover:from-amber-500/30 hover:to-orange-600/30 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/30 to-transparent rounded-full -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <div className="text-amber-400 font-bold text-sm">EXCLUSIF</div>
                  </div>
                  <h4 className="text-white font-bold text-lg mb-3">Budget vs Réel</h4>
                  <p className="text-amber-100 text-sm font-medium">
                    Comparaison temps réel budget/réel avec alertes intelligentes. Unique sur le marché!
                  </p>
                </div>
              </div>
            </div>

            {/* Trust indicator */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2 text-green-400">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">Sécurité bancaire</span>
                </div>
                <div className="flex items-center gap-2 text-blue-400">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-medium">IA certifiée</span>
                </div>
                <div className="flex items-center gap-2 text-cyan-400">
                  <Zap className="h-4 w-4" />
                  <span className="font-medium">Performance optimale</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
