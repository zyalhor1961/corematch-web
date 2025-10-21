import { Header } from './components/layout/header';
import { Footer } from './components/layout/footer';
import ChatWidget from './components/chatbot/ChatWidget';
import { Zap, Shield, BarChart3, FileText, Users } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
          <div className="text-center">
            <div className="inline-block px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 mb-8">
              ✨ Powered by Advanced AI
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-8 leading-tight">
              Automatisation
              <br />
              <span className="text-blue-600 dark:text-blue-400">Intelligente</span>
            </h1>

            <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Optimisez vos processus de recrutement et de gestion documentaire 
              avec nos outils d&apos;IA. Solutions enterprise pour équipes modernes.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
              <a href="/register" className="inline-flex items-center px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105">
                Commencer maintenant
              </a>
              <a href="#products" className="inline-flex items-center px-8 py-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300">
                Découvrir nos solutions
              </a>
            </div>
          </div>
        </div>

        {/* Geometric background */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-blue-900 rounded-full opacity-10"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-80 h-80 bg-gray-200 dark:bg-gray-800 rounded-full opacity-20"></div>
      </section>

      {/* Products Section */}
      <section id="products" className="py-24 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Nos Solutions
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Deux modules puissants pour automatiser vos processus métier
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* CV Screening */}
            <div className="group cursor-pointer">
              <div className="bg-white dark:bg-gray-700 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-500 transform hover:-translate-y-2">
                <div className="flex items-center mb-6">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mr-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                    <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">CV Screening</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Recrutement IA</p>
                  </div>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                  Analysez et classez automatiquement des centaines de CV en quelques minutes. 
                  Scoring intelligent et export des meilleurs candidats.
                </p>
                
                <div className="space-y-4 mb-8">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-3"></div>
                    5-200 CV analysés simultanément
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-3"></div>
                    Scoring automatique avec IA
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-3"></div>
                    Export CSV pour équipes RH
                  </div>
                </div>

                <a href="/products/cv-screening" className="inline-flex items-center text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-500 transition-colors">
                  Découvrir le module
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            </div>

            {/* DEB Assistant */}
            <div className="group cursor-pointer">
              <div className="bg-white dark:bg-gray-700 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-500 transform hover:-translate-y-2">
                <div className="flex items-center mb-6">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mr-4 group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                    <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">DEB Assistant</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Automatisation documentaire</p>
                  </div>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                  Transformez vos factures intracommunautaires scannées en données DEB exploitables.
                  OCR Azure et traitement IA automatisé.
                </p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-3"></div>
                    OCR Azure multi-pages
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-3"></div>
                    Classification intelligente facture/BL
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-3"></div>
                    Export CSV format DEB
                  </div>
                </div>

                <a href="/products/deb-assistant" className="inline-flex items-center text-green-600 dark:text-green-400 font-medium hover:text-green-700 dark:hover:text-green-500 transition-colors">
                  Découvrir le module
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Pourquoi CoreMatch ?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Une solution enterprise, sécurisée et conforme RGPD
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                <Zap className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Automatisation intelligente
              </h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                IA de pointe avec OpenAI GPT-4 et Azure Document Intelligence pour des résultats précis
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                <Shield className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Sécurité & Conformité
              </h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Données hébergées en UE, conformité RGPD et isolation multi-tenant garantie
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                <BarChart3 className="h-10 w-10 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Mise à l&apos;échelle
              </h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                De 50 à 10,000+ documents traités par mois selon vos besoins d&apos;entreprise
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Prêt à commencer ?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-12">
            Essai gratuit 14 jours • Pas de carte bancaire • Support inclus
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/register" className="inline-flex items-center px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 font-medium">
              Démarrer l&apos;essai gratuit
            </a>
            <a href="/pricing" className="inline-flex items-center px-8 py-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300">
              Voir les tarifs
            </a>
          </div>
        </div>
      </section>

      <Footer />
      <ChatWidget />
    </div>
  );
}