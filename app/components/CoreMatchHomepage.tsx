"use client";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Briefcase, Brain, Zap, Users, ArrowRight, CheckCircle, Play, Shield, BarChart3, FileText, Share2
} from "lucide-react";
import ChatWidget from "./chatbot/ChatWidget";

export default function CoreMatchHomepage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleStartFree = () => {
    // TODO: brancher Stripe Checkout
    window.location.href = "#pricing";
  };
  const handleDemo = () => {
    // TODO: brancher Calendly / page demo
    window.location.href = "#modules";
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* NAV */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-white shadow-sm">
                <Briefcase className="h-5 w-5" />
              </span>
              <span className="ml-3 text-xl font-bold tracking-tight">CoreMatch</span>
            </Link>

            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-600 hover:text-slate-900">Fonctionnalités</a>
              <a href="#modules" className="text-slate-600 hover:text-slate-900">Modules</a>
              <a href="#pricing" className="text-slate-600 hover:text-slate-900">Tarifs</a>
              <Link href="/login" className="text-slate-600 hover:text-slate-900">Se connecter</Link>
              <button
                onClick={handleStartFree}
                className="inline-flex items-center rounded-lg bg-slate-900 text-white px-4 py-2.5 font-medium hover:bg-slate-800"
              >
                Essai gratuit <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>

            <button
              className="md:hidden p-2 rounded-lg border border-slate-200"
              aria-label="Menu"
              onClick={() => setIsMenuOpen((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>
          </div>

          {isMenuOpen && (
            <div className="md:hidden mt-3 space-y-2 pb-3">
              {[
                ["#features","Fonctionnalités"],
                ["#modules","Modules"],
                ["#pricing","Tarifs"],
                ["/login","Se connecter"],
              ].map(([href,label]) => (
                <Link key={label} href={href} className="block rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50">
                  {label}
                </Link>
              ))}
              <button
                onClick={handleStartFree}
                className="w-full rounded-lg bg-slate-900 text-white px-3 py-2 font-medium"
              >
                Essai gratuit
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* HERO */}
      <header className="bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-14 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            <Shield className="h-4 w-4 text-emerald-600" /> RGPD • Hébergement UE • Audit & traçabilité
          </div>

          <h1 className="mt-6 text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
            Automatisez vos recrutements & processus
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-cyan-600">
              avec une IA qui reste compréhensible
            </span>
          </h1>

          <p className="mt-5 text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
            CoreMatch centralise le screening de CV, le traitement documentaire et la gestion social media
            dans une plateforme claire, mesurable et prête pour l’entreprise.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleStartFree}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-6 py-3 font-semibold hover:bg-slate-800"
            >
              Démarrer gratuitement <ArrowRight className="ml-2 h-4 w-4" />
            </button>
            <button
              onClick={handleDemo}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-50"
            >
              Voir la démo <Play className="ml-2 h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-slate-500">
            <span className="inline-flex items-center"><CheckCircle className="h-4 w-4 text-emerald-600 mr-2"/>Essai 14 jours</span>
            <span className="inline-flex items-center"><CheckCircle className="h-4 w-4 text-emerald-600 mr-2"/>Sans carte bancaire</span>
          </div>
        </div>
      </header>

      {/* FEATURES */}
      <section id="features" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-extrabold">Pourquoi CoreMatch</h2>
            <p className="mt-3 text-slate-600">Des gains concrets, mesurables, et un déploiement rapide.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Brain, title: "IA explicable", desc: "Scores + raisons claires (forces, écarts, points de vigilance)." },
              { icon: Zap, title: "Temps ×10", desc: "Screening automatique, résumés instantanés, exports en 1 clic." },
              { icon: BarChart3, title: "Pilotage & KPI", desc: "Tableau de bord, SLA et traçabilité des décisions." },
            ].map((f, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6">
                <f.icon className="h-6 w-6 text-indigo-600" />
                <h3 className="mt-4 text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <h2 className="text-3xl md:text-4xl font-extrabold">Modules</h2>
            <p className="text-slate-600">Activez seulement ce dont vous avez besoin.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-white border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-indigo-600" />
                <h3 className="text-xl font-semibold">Screening RH</h3>
              </div>
              <p className="mt-2 text-slate-600">Analyse et scoring des CV, matching avec l’offre, shortlist & exports.</p>
              <Link href="/products/screening" className="mt-4 inline-flex text-indigo-700 hover:underline">Découvrir →</Link>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-indigo-600" />
                <h3 className="text-xl font-semibold">DocFlow</h3>
              </div>
              <p className="mt-2 text-slate-600">OCR + extraction + validation + export (Factures, contrats, PDF divers).</p>
              <Link href="/products/docflow" className="mt-4 inline-flex text-indigo-700 hover:underline">Découvrir →</Link>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <Share2 className="h-6 w-6 text-indigo-600" />
                <h3 className="text-xl font-semibold">SocialPilot</h3>
              </div>
              <p className="mt-2 text-slate-600">Rédaction, calendrier et publication multi-réseaux assistés par IA.</p>
              <Link href="/products/socialpilot" className="mt-4 inline-flex text-indigo-700 hover:underline">Découvrir →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-extrabold">Tarifs simples, sans surprise</h2>
            <p className="mt-3 text-slate-600">Commencez gratuitement. Passez à l’échelle quand vous êtes prêt.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-xl font-semibold">Pack PME</h3>
              <p className="mt-1 text-slate-600">Screening / docs ponctuels</p>
              <div className="mt-4 text-4xl font-extrabold">199€</div>
              <ul className="mt-4 space-y-2 text-slate-600">
                <li>• 30 runs (CV ou documents)</li>
                <li>• Résumés IA + export</li>
                <li>• Support standard</li>
              </ul>
              <button onClick={handleStartFree} className="mt-6 w-full rounded-lg bg-slate-900 text-white py-2.5 font-semibold">Acheter</button>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
              <div className="inline-flex text-xs rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5">Recommandé</div>
              <h3 className="mt-2 text-xl font-semibold">Agences</h3>
              <p className="mt-1 text-slate-600">Usage régulier</p>
              <div className="mt-4 text-4xl font-extrabold">490€ <span className="text-base font-medium text-slate-500">/mois</span></div>
              <ul className="mt-4 space-y-2 text-slate-600">
                <li>• 200 runs / mois</li>
                <li>• API & intégrations</li>
                <li>• Support prioritaire</li>
              </ul>
              <button onClick={handleStartFree} className="mt-6 w-full rounded-lg bg-indigo-600 text-white py-2.5 font-semibold hover:bg-indigo-700">Essai 14 jours</button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-xl font-semibold">Entreprise</h3>
              <p className="mt-1 text-slate-600">Besoins avancés</p>
              <div className="mt-4 text-4xl font-extrabold">Sur devis</div>
              <ul className="mt-4 space-y-2 text-slate-600">
                <li>• Hébergement dédié UE</li>
                <li>• SSO / RBAC avancé</li>
                <li>• SLA & accompagnement</li>
              </ul>
              <a href="mailto:sales@corematch.ai?subject=Demande%20Entreprise" className="mt-6 w-full inline-flex justify-center rounded-lg border border-slate-200 py-2.5 font-semibold hover:bg-slate-50">
                Contacter les ventes
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-white border border-slate-200 p-6 md:p-8">
            <div className="md:flex items-center gap-6">
              <Image src="https://i.pravatar.cc/80?img=15" alt="Client" width={64} height={64} className="h-16 w-16 rounded-full" />
              <div className="mt-4 md:mt-0">
                <p className="text-lg">
                  “CoreMatch nous fait gagner des heures chaque semaine et améliore la qualité des shortlists.”
                </p>
                <p className="mt-2 text-slate-600 text-sm">Nadia, Talent Lead — TechCorp</p>
              </div>
              <div className="mt-6 md:mt-0 md:ml-auto">
                <button onClick={handleDemo} className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2 font-semibold hover:bg-slate-50">
                  Voir la démo <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold">Prêt à démarrer ?</h2>
          <p className="mt-3 text-slate-600">Créez votre compte en 2 minutes. Annulable à tout moment.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={handleStartFree} className="rounded-xl bg-slate-900 text-white px-6 py-3 font-semibold hover:bg-slate-800">Créer mon compte</button>
            <Link href="/login" className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold hover:bg-slate-50">Se connecter</Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">TVA non applicable — art. 293 B du CGI</p>
        </div>
      </section>

      <ChatWidget />
    </div>
  );
}
