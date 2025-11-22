'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageSquare,
  Search,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface AskDafHeroProps {
  orgId: string;
}

const suggestions = [
  { label: 'Dépenses novembre', query: 'Quelles sont mes dépenses de novembre?' },
  { label: 'Factures impayées', query: 'Liste des factures impayées' },
  { label: 'Fournisseurs 2024', query: 'Top fournisseurs en 2024' },
  { label: 'Montant payé ce mois', query: 'Montant total des paiements reçus ce mois' },
];

export function AskDafHero({ orgId }: AskDafHeroProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/org/${orgId}/daf?tab=ask&q=${encodeURIComponent(query)}`);
    } else {
      router.push(`/org/${orgId}/daf?tab=ask`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    router.push(`/org/${orgId}/daf?tab=ask&q=${encodeURIComponent(suggestion)}`);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-8 md:p-10">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-white blur-3xl" />
      </div>

      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Ask DAF – Votre copilote financier IA
          </h2>
        </div>

        <p className="text-blue-100 text-lg mb-6 max-w-2xl">
          Posez vos questions sur votre comptabilité, vos factures, vos dépenses.
          L'IA analyse vos données et vous répond instantanément.
        </p>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Posez votre question..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-12 h-14 text-lg bg-white dark:bg-gray-900 border-0 shadow-xl rounded-xl focus-visible:ring-2 focus-visible:ring-white/50"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-14 px-8 bg-white text-blue-600 hover:bg-blue-50 shadow-xl rounded-xl font-semibold"
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              Demander à DAF
            </Button>
          </div>
        </form>

        <div className="flex flex-wrap gap-2">
          <span className="text-blue-200 text-sm">Suggestions:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              onClick={() => handleSuggestionClick(suggestion.query)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur text-white text-sm rounded-full transition-colors"
            >
              {suggestion.label}
              <ArrowRight className="h-3 w-3" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
