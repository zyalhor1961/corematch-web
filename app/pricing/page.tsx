import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { PricingTable } from '../components/ui/pricing-table';
import { Check } from 'lucide-react';

export default function PricingPage() {
  const plans = [
    {
      name: 'Starter',
      price: 4900, // €49 in cents
      period: 'mois',
      description: 'Pour les petites équipes qui découvrent l\'automatisation',
      features: [
        '200 CV analysés/mois',
        '200 pages DEB/mois',
        '3 projets CV',
        '5 utilisateurs max',
        'Support email',
        'Export CSV',
        'Rétention 90 jours'
      ],
      cta: {
        text: 'Commencer l\'essai',
        href: '/register?plan=starter'
      }
    },
    {
      name: 'Pro',
      price: 14900, // €149 in cents
      period: 'mois',
      description: 'Pour les équipes en croissance avec des besoins réguliers',
      popular: true,
      features: [
        '1000 CV analysés/mois',
        '1500 pages DEB/mois',
        'Projets CV illimités',
        '15 utilisateurs max',
        'Support prioritaire',
        'Export CSV & Excel',
        'Rétention 1 an',
        'Webhooks API',
        'Référentiel produits'
      ],
      cta: {
        text: 'Choisir Pro',
        href: '/register?plan=pro'
      }
    },
    {
      name: 'Scale',
      price: 39900, // €399 in cents
      period: 'mois',
      description: 'Pour les entreprises avec des volumes importants',
      features: [
        'CV illimités',
        '10000 pages DEB/mois',
        'Projets & utilisateurs illimités',
        'Support téléphone & chat',
        'SLA 99.9%',
        'Multi-entités',
        'Rétention personnalisée',
        'API complète',
        'Intégrations sur mesure',
        'Formation incluse'
      ],
      cta: {
        text: 'Contacter les ventes',
        href: '/contact'
      }
    }
  ];

  const features = [
    {
      category: 'CV Screening',
      items: [
        { name: 'Analyse IA des CV', starter: true, pro: true, scale: true },
        { name: 'Scoring automatique', starter: true, pro: true, scale: true },
        { name: 'Export candidats', starter: true, pro: true, scale: true },
        { name: 'Gestion projets', starter: '3 projets', pro: 'Illimité', scale: 'Illimité' },
        { name: 'Formats supportés', starter: 'PDF', pro: 'PDF, DOCX', scale: 'Tous formats' },
      ]
    },
    {
      category: 'DEB Assistant',
      items: [
        { name: 'OCR Azure', starter: true, pro: true, scale: true },
        { name: 'Classification IA', starter: true, pro: true, scale: true },
        { name: 'Export CSV DEB', starter: true, pro: true, scale: true },
        { name: 'Référentiel produits', starter: false, pro: true, scale: true },
        { name: 'Multi-entités', starter: false, pro: false, scale: true },
      ]
    },
    {
      category: 'Collaboration',
      items: [
        { name: 'Utilisateurs inclus', starter: '5', pro: '15', scale: 'Illimité' },
        { name: 'Rôles & permissions', starter: true, pro: true, scale: true },
        { name: 'Audit logs', starter: false, pro: true, scale: true },
        { name: 'Single Sign-On (SSO)', starter: false, pro: false, scale: true },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Tarifs simples et transparents
          </h1>
          <p className="text-xl text-blue-100 mb-8">
            Choisissez le plan qui correspond à vos besoins. Changez ou annulez à tout moment.
          </p>
          <div className="bg-blue-500 rounded-lg p-4 inline-block">
            <p className="text-white font-medium">
              🎉 Essai gratuit 14 jours sur tous les plans
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Table */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PricingTable plans={plans} />
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Comparaison détaillée
            </h2>
            <p className="text-xl text-gray-600">
              Toutes les fonctionnalités par plan
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {features.map((category, categoryIndex) => (
              <div key={categoryIndex} className={categoryIndex > 0 ? 'border-t' : ''}>
                <div className="bg-gray-100 px-6 py-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {category.category}
                  </h3>
                </div>
                {category.items.map((feature, featureIndex) => (
                  <div key={featureIndex} className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-4 border-b border-gray-100 last:border-b-0">
                    <div className="font-medium text-gray-900">
                      {feature.name}
                    </div>
                    <div className="text-center">
                      {typeof feature.starter === 'boolean' ? (
                        feature.starter ? (
                          <Check className="h-5 w-5 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )
                      ) : (
                        <span className="text-sm text-gray-600">{feature.starter}</span>
                      )}
                    </div>
                    <div className="text-center">
                      {typeof feature.pro === 'boolean' ? (
                        feature.pro ? (
                          <Check className="h-5 w-5 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )
                      ) : (
                        <span className="text-sm text-gray-600">{feature.pro}</span>
                      )}
                    </div>
                    <div className="text-center">
                      {typeof feature.scale === 'boolean' ? (
                        feature.scale ? (
                          <Check className="h-5 w-5 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )
                      ) : (
                        <span className="text-sm text-gray-600">{feature.scale}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Questions fréquentes
            </h2>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Puis-je changer de plan à tout moment ?
              </h3>
              <p className="text-gray-600">
                Oui, vous pouvez passer à un plan supérieur ou inférieur à tout moment. 
                Les changements prennent effet immédiatement avec une facturation au prorata.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Que se passe-t-il si je dépasse mon quota ?
              </h3>
              <p className="text-gray-600">
                Vous recevrez une notification avant d&apos;atteindre votre limite. 
                Vous pouvez soit upgrader votre plan, soit attendre le mois suivant.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Les données sont-elles sécurisées ?
              </h3>
              <p className="text-gray-600">
                Absolument. Toutes les données sont hébergées en Europe, chiffrées et 
                conformes RGPD. Nous appliquons les meilleures pratiques de sécurité.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Y a-t-il un engagement minimum ?
              </h3>
              <p className="text-gray-600">
                Non, tous nos plans sont sans engagement. Vous pouvez annuler à tout moment 
                depuis votre tableau de bord.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}