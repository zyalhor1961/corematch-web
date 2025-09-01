import { Header } from '../../components/layout/header';
import { Footer } from '../../components/layout/footer';
import { Hero } from '../../components/ui/hero';
import { Button } from '../../components/ui/button';
import { Check, FileText, Zap, Download, ArrowRight } from 'lucide-react';

export default function DEBAssistantProductPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      <Header />
      
      {/* Hero Section */}
      <Hero
        title="DEB Assistant"
        subtitle="Traitement automatique des factures intracommunautaires"
        description="Transformez vos factures scannées en données DEB exploitables. OCR Azure, classification IA et export CSV automatisés pour vos déclarations douanières."
        primaryCta={{
          text: "Essai gratuit",
          href: "/register?plan=pro"
        }}
        secondaryCta={{
          text: "Voir une démo",
          href: "#demo"
        }}
      />

      {/* Features Section */}
      <section className="py-24 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-green-900/30 to-slate-900/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),rgba(255,255,255,0))] animate-pulse"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-full border border-emerald-500/20 mb-6">
              <span className="text-emerald-300 text-sm font-medium">📄 AI Document Processing</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white via-emerald-100 to-green-100 bg-clip-text text-transparent mb-4">
              Du PDF scanné au CSV DEB en automatique
            </h2>
            <p className="text-xl text-gray-300">
              4 étapes pour simplifier vos déclarations intracommunautaires avec l&apos;IA
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 p-4 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center border border-blue-500/30 group-hover:border-blue-400/50 transition-all duration-300">
                <FileText className="h-8 w-8 text-blue-400 group-hover:text-blue-300 transition-colors duration-300" />
              </div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-blue-100 to-cyan-100 bg-clip-text text-transparent mb-2">
                1. Upload PDF
              </h3>
              <p className="text-gray-300">
                Déposez vos factures et bons de livraison scannés (multi-pages supportées)
              </p>
            </div>

            <div className="text-center group">
              <div className="bg-gradient-to-br from-emerald-500/20 to-green-600/20 p-4 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center border border-emerald-500/30 group-hover:border-emerald-400/50 transition-all duration-300">
                <Zap className="h-8 w-8 text-emerald-400 group-hover:text-emerald-300 transition-colors duration-300" />
              </div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-emerald-100 to-green-100 bg-clip-text text-transparent mb-2">
                2. OCR et IA
              </h3>
              <p className="text-gray-300">
                Azure OCR extrait le texte, l&apos;IA classe et segmente factures et BL
              </p>
            </div>

            <div className="text-center group">
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-600/20 p-4 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center border border-purple-500/30 group-hover:border-purple-400/50 transition-all duration-300">
                <FileText className="h-8 w-8 text-purple-400 group-hover:text-purple-300 transition-colors duration-300" />
              </div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-100 to-pink-100 bg-clip-text text-transparent mb-2">
                3. Enrichissement
              </h3>
              <p className="text-gray-300">
                Extraction lignes, mapping HS codes, poids et répartition frais de port
              </p>
            </div>

            <div className="text-center group">
              <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 p-4 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center border border-amber-500/30 group-hover:border-amber-400/50 transition-all duration-300">
                <Download className="h-8 w-8 text-amber-400 group-hover:text-amber-300 transition-colors duration-300" />
              </div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-amber-100 to-orange-100 bg-clip-text text-transparent mb-2">
                4. Export DEB
              </h3>
              <p className="text-gray-300">
                CSV prêt pour import dans votre logiciel de déclaration DEB
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Details */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900/50"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-emerald-100 to-green-100 bg-clip-text text-transparent mb-6">
                Fonctionnalités expertes
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-emerald-400 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-emerald-100">OCR performant</h3>
                    <p className="text-gray-300">Azure Document Intelligence pour une reconnaissance parfaite</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-emerald-400 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-emerald-100">Classification intelligente</h3>
                    <p className="text-gray-300">Distinction automatique facture/BL et appariement des documents</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-emerald-400 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-emerald-100">Référentiel produits</h3>
                    <p className="text-gray-300">Base de données HS codes et poids pour enrichissement automatique</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-green-500 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-emerald-100">Répartition frais</h3>
                    <p className="text-gray-300">Allocation automatique des coûts par valeur, poids ou quantité</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-emerald-400 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-emerald-100">Contrôles qualité</h3>
                    <p className="text-gray-300">Validation des totaux et détection des anomalies</p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="mt-10 lg:mt-0">
              <div className="bg-gradient-to-br from-slate-800/50 to-emerald-900/50 backdrop-blur-lg border border-emerald-500/20 rounded-2xl p-8 shadow-2xl">
                <h3 className="text-lg font-semibold text-emerald-100 mb-4">Exemple de traitement</h3>
                <div className="space-y-3">
                  <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-blue-500/10">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-100">Facture détectée</span>
                      <span className="px-2 py-1 bg-gradient-to-r from-blue-500/20 to-cyan-600/20 text-blue-300 text-xs rounded-full border border-blue-500/30">Page 1-2</span>
                    </div>
                    <p className="text-xs text-gray-300 mt-1">Fournisseur: ABC GmbH • Total: 1,250.00€</p>
                  </div>
                  <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-emerald-500/10">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-100">BL apparié</span>
                      <span className="px-2 py-1 bg-gradient-to-r from-emerald-500/20 to-green-600/20 text-emerald-300 text-xs rounded-full border border-emerald-500/30">Page 3</span>
                    </div>
                    <p className="text-xs text-gray-300 mt-1">Poids mappé: 125kg • 15 lignes extraites</p>
                  </div>
                  <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-purple-500/10">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-100">CSV généré</span>
                      <span className="px-2 py-1 bg-gradient-to-r from-purple-500/20 to-pink-600/20 text-purple-300 text-xs rounded-full border border-purple-500/30">Prêt</span>
                    </div>
                    <p className="text-xs text-gray-300 mt-1">Format DEB • Codes HS enrichis • Frais répartis</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-green-900/30 to-slate-900/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),rgba(255,255,255,0))] animate-pulse"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-emerald-100 to-green-100 bg-clip-text text-transparent mb-4">
              Qui utilise DEB Assistant ?
            </h2>
            <p className="text-xl text-gray-300">
              Parfait pour les entreprises avec des flux intracommunautaires
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg border border-emerald-500/20 rounded-2xl p-6 shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 group">
              <h3 className="text-xl font-semibold bg-gradient-to-r from-emerald-100 to-green-100 bg-clip-text text-transparent mb-3">Importateurs</h3>
              <p className="text-gray-300 mb-4">
                Traitement automatique des factures fournisseurs européens pour déclarations DEB d&apos;acquisition.
              </p>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• 50-500 factures/mois</li>
                <li>• Multiples fournisseurs EU</li>
                <li>• Codes HS variables</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg border border-cyan-500/20 rounded-2xl p-6 shadow-2xl hover:shadow-cyan-500/10 transition-all duration-500 group">
              <h3 className="text-xl font-semibold bg-gradient-to-r from-cyan-100 to-blue-100 bg-clip-text text-transparent mb-3">E-commerce</h3>
              <p className="text-gray-300 mb-4">
                Automatisation DEB pour les plateformes vendant dans plusieurs pays européens.
              </p>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Volume important de commandes</li>
                <li>• Expéditions multiples</li>
                <li>• Conformité automatisée</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg border border-purple-500/20 rounded-2xl p-6 shadow-2xl hover:shadow-purple-500/10 transition-all duration-500 group">
              <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-100 to-pink-100 bg-clip-text text-transparent mb-3">Transitaires</h3>
              <p className="text-gray-300 mb-4">
                Service à valeur ajoutée pour clients avec traitement documentaire automatisé.
              </p>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Prestations clients multiples</li>
                <li>• Documents hétérogènes</li>
                <li>• Qualité de service</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-green-600 to-cyan-600 opacity-90"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/20 to-black/40"></div>
        
        {/* Animated particles */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-2 h-2 bg-white/20 rounded-full animate-bounce"></div>
          <div className="absolute top-40 right-20 w-3 h-3 bg-emerald-400/30 rounded-full animate-pulse"></div>
          <div className="absolute bottom-20 left-1/4 w-1 h-1 bg-green-400/40 rounded-full animate-ping"></div>
          <div className="absolute bottom-40 right-1/3 w-2 h-2 bg-cyan-400/30 rounded-full animate-bounce" style={{animationDelay: '1s'}}></div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Simplifiez vos DEB dès aujourd&apos;hui
          </h2>
          <p className="text-xl text-white/80 mb-8">
            Essai gratuit avec traitement de 50 pages incluses
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/register">
              <Button size="lg" className="bg-white text-emerald-600 hover:bg-gray-50 px-8 shadow-lg hover:shadow-xl transition-all duration-300">
                Commencer l&apos;essai gratuit
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
            <a href="/pricing">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-emerald-600 px-8 backdrop-blur-sm">
                Voir les tarifs
              </Button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}