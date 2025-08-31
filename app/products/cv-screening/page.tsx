import { Header } from '../../components/layout/header';
import { Footer } from '../../components/layout/footer';
import { Hero } from '../../components/ui/hero';
import { Button } from '../../components/ui/button';
import { Check, Users, Zap, Target, ArrowRight } from 'lucide-react';

export default function CVScreeningProductPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Header />
      
      {/* Hero Section */}
      <Hero
        title="CV Screening"
        subtitle="Analyse automatique de CV avec IA"
        description="Triez et analysez des centaines de candidatures en quelques minutes. Scoring intelligent, extraction de données et shortlisting automatique."
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
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-cyan-900/30 to-slate-900/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),rgba(255,255,255,0))] animate-pulse"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-full border border-blue-500/20 mb-6">
              <span className="text-blue-300 text-sm font-medium">🚀 AI-Powered Recruitment</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white via-cyan-100 to-blue-100 bg-clip-text text-transparent mb-4">
              Comment ça marche ?
            </h2>
            <p className="text-xl text-gray-300">
              3 étapes pour transformer vos recrutements avec l'IA
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 p-4 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center border border-blue-500/30 group-hover:border-blue-400/50 transition-all duration-300">
                <Users className="h-8 w-8 text-blue-400 group-hover:text-blue-300 transition-colors duration-300" />
              </div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-blue-100 to-cyan-100 bg-clip-text text-transparent mb-2">
                1. Uploadez les CV
              </h3>
              <p className="text-gray-300">
                Déposez 5 à 200 CV PDF dans votre projet. Compatible avec tous les formats de CV.
              </p>
            </div>

            <div className="text-center group">
              <div className="bg-gradient-to-br from-emerald-500/20 to-green-600/20 p-4 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center border border-emerald-500/30 group-hover:border-emerald-400/50 transition-all duration-300">
                <Zap className="h-8 w-8 text-emerald-400 group-hover:text-emerald-300 transition-colors duration-300" />
              </div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-emerald-100 to-green-100 bg-clip-text text-transparent mb-2">
                2. IA analyse et score
              </h3>
              <p className="text-gray-300">
                Notre IA GPT-4 analyse chaque CV et attribue un score de 0 à 100 avec explication détaillée.
              </p>
            </div>

            <div className="text-center group">
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-600/20 p-4 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center border border-purple-500/30 group-hover:border-purple-400/50 transition-all duration-300">
                <Target className="h-8 w-8 text-purple-400 group-hover:text-purple-300 transition-colors duration-300" />
              </div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-100 to-pink-100 bg-clip-text text-transparent mb-2">
                3. Shortlistez et exportez
              </h3>
              <p className="text-gray-300">
                Sélectionnez les meilleurs profils et exportez votre shortlist en CSV pour votre équipe.
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
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent mb-6">
                Fonctionnalités avancées
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-emerald-400 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-cyan-100">Scoring intelligent</h3>
                    <p className="text-gray-300">Algorithme adaptatif qui s'ajuste selon vos critères de poste</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-emerald-400 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-cyan-100">Extraction de données</h3>
                    <p className="text-gray-300">Nom, email, téléphone et compétences détectés automatiquement</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-emerald-400 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-cyan-100">Gestion de projets</h3>
                    <p className="text-gray-300">Organisez vos recrutements par poste et suivez l'avancement</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <Check className="h-6 w-6 text-emerald-400 mr-3 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-cyan-100">Collaboration équipe</h3>
                    <p className="text-gray-300">Partagez vos analyses avec votre équipe RH et les managers</p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="mt-10 lg:mt-0">
              <div className="bg-gradient-to-br from-slate-800/50 to-blue-900/50 backdrop-blur-lg border border-blue-500/20 rounded-2xl p-8 shadow-2xl">
                <div className="space-y-4">
                  <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-cyan-500/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-100">Jean Dupont</span>
                      <span className="px-3 py-1 bg-gradient-to-r from-emerald-500/20 to-green-600/20 text-emerald-300 text-xs font-medium rounded-full border border-emerald-500/30">
                        Score: 92/100
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mt-1">Développeur Full Stack • 5 ans d'exp.</p>
                  </div>
                  <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-blue-500/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-100">Marie Martin</span>
                      <span className="px-3 py-1 bg-gradient-to-r from-blue-500/20 to-cyan-600/20 text-blue-300 text-xs font-medium rounded-full border border-blue-500/30">
                        Score: 87/100
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mt-1">Product Manager • React, Node.js</p>
                  </div>
                  <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-amber-500/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-100">Paul Bernard</span>
                      <span className="px-3 py-1 bg-gradient-to-r from-amber-500/20 to-yellow-600/20 text-amber-300 text-xs font-medium rounded-full border border-amber-500/30">
                        Score: 76/100
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mt-1">Designer UX/UI • 3 ans d'exp.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-600 to-purple-600 opacity-90"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/20 to-black/40"></div>
        
        {/* Animated particles */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-2 h-2 bg-white/20 rounded-full animate-bounce"></div>
          <div className="absolute top-40 right-20 w-3 h-3 bg-cyan-400/30 rounded-full animate-pulse"></div>
          <div className="absolute bottom-20 left-1/4 w-1 h-1 bg-blue-400/40 rounded-full animate-ping"></div>
          <div className="absolute bottom-40 right-1/3 w-2 h-2 bg-purple-400/30 rounded-full animate-bounce" style={{animationDelay: '1s'}}></div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Prêt à révolutionner vos recrutements ?
          </h2>
          <p className="text-xl text-white/80 mb-8">
            Commencez votre essai gratuit et analysez jusqu'à 50 CV gratuitement
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/register">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-50 px-8 shadow-lg hover:shadow-xl transition-all duration-300">
                Commencer l'essai gratuit
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
            <a href="/pricing">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-blue-600 px-8 backdrop-blur-sm">
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