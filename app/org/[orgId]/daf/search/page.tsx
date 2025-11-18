'use client';

import { useState } from 'react';
import { Search, FileText, Calendar, DollarSign, Building2, Sparkles, Loader2 } from 'lucide-react';

interface SearchResult {
  chunk_text: string;
  source_metadata: {
    file_name?: string;
    doc_type?: string;
    fournisseur?: string;
    date_document?: string;
    montant_ttc?: number;
    numero_facture?: string;
  };
  vector_similarity: number;
  fts_rank?: number;
  combined_score?: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  execution_time_ms: number;
}

export default function DAFSearchPage({ params }: { params: Promise<{ orgId: string }> }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const { orgId } = await params;
      const response = await fetch('/api/rag/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          org_id: orgId,
          content_type: 'daf_document',
          limit: 10,
          mode: 'hybrid',
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: SearchResponse = await response.json();
      setResults(data.results || []);
      setSearchTime(data.execution_time_ms || 0);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search documents. Please try again.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Premium Header */}
      <div className="relative bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 border-b border-slate-800 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-blue-600/20 blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600 blur-xl opacity-50 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-blue-500 to-cyan-600 p-3 rounded-xl shadow-lg">
                <Search className="h-8 w-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                Recherche Sémantique
              </h1>
              <p className="text-sm text-blue-200/80 flex items-center gap-2 mt-1">
                <Sparkles className="h-3 w-3" />
                Recherche intelligente dans vos documents DAF
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Form */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/50 p-8 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Recherchez vos factures, fournisseurs, montants..."
                className="w-full px-6 py-4 pl-14 text-lg rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none"
              />
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Exemples: "factures EDF janvier", "fournisseur LandingAI", "montant supérieur à 1000€"
              </p>
              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Recherche...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5" />
                    Rechercher
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Results */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {results.length} résultat{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}
              </h2>
              <p className="text-sm text-slate-600">
                Recherche effectuée en <span className="font-semibold text-blue-600">{searchTime}ms</span>
              </p>
            </div>

            {results.map((result, index) => (
              <div
                key={index}
                className="bg-white/90 backdrop-blur-xl rounded-xl shadow-lg border border-slate-200/50 p-6 hover:shadow-xl transition-all"
              >
                {/* Document Metadata */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-2 rounded-lg">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {result.source_metadata.file_name || 'Document'}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {result.source_metadata.doc_type || 'Document'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                      {Math.round((result.combined_score || result.vector_similarity || 0) * 100)}% pertinent
                    </div>
                  </div>
                </div>

                {/* Document Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {result.source_metadata.fournisseur && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">{result.source_metadata.fournisseur}</span>
                    </div>
                  )}
                  {result.source_metadata.date_document && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">
                        {new Date(result.source_metadata.date_document).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  )}
                  {result.source_metadata.montant_ttc && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-semibold text-slate-700">
                        {result.source_metadata.montant_ttc.toFixed(2)}€
                      </span>
                    </div>
                  )}
                  {result.source_metadata.numero_facture && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">{result.source_metadata.numero_facture}</span>
                    </div>
                  )}
                </div>

                {/* Content Preview */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-sm text-slate-700 line-clamp-3">
                    {result.chunk_text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isSearching && results.length === 0 && query && (
          <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow-lg border border-slate-200/50 p-12 text-center">
            <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Aucun résultat trouvé</h3>
            <p className="text-slate-600">
              Essayez avec d'autres mots-clés ou une formulation différente
            </p>
          </div>
        )}

        {!query && (
          <div className="bg-white/90 backdrop-blur-xl rounded-xl shadow-lg border border-slate-200/50 p-12 text-center">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Recherche sémantique intelligente</h3>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Notre système de recherche IA comprend le contexte de vos requêtes.
              Posez vos questions en langage naturel pour trouver rapidement les documents pertinents.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
