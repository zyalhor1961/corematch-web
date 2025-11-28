'use client';

import React, { useState, useEffect } from 'react';
import PageContainer from '@/components/ui/PageContainer';
import { InsightsWidget } from '@/components/Insights';
import { Sparkles, Send, Download, FileText, FileSpreadsheet, Lightbulb, Globe } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function InsightsPageEnhanced() {
    const params = useParams();
    const orgId = params.orgId as string;
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<any>(null);
    const [language, setLanguage] = useState<'fr' | 'en'>('fr');
    const [exporting, setExporting] = useState(false);

    // Load smart suggestions on mount
    useEffect(() => {
        if (orgId) {
            loadSuggestions();
        }
    }, [language, orgId]);

    const loadSuggestions = async () => {
        try {
            const response = await fetch(`/api/insights/suggestions?language=${language}&orgId=${orgId}`);
            if (response.ok) {
                const data = await response.json();
                setSuggestions(data);
            }
        } catch (err) {
            console.error('Failed to load suggestions:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!query.trim()) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/insights', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    orgId: orgId,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                let errorMsg = 'Failed to get insights';
                try {
                    const errorData = JSON.parse(text);
                    errorMsg = errorData.error || errorMsg;
                } catch {
                    errorMsg = text || errorMsg;
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            setResult(data.result);

            // Reload suggestions after query (to update popular queries)
            loadSuggestions();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format: 'pdf' | 'excel') => {
        if (!result) return;

        setExporting(true);
        try {
            const response = await fetch('/api/insights/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    result,
                    query,
                    orgName: 'CoreMatch',
                    format,
                }),
            });

            if (!response.ok) {
                throw new Error('Export failed');
            }

            const data = await response.json();

            // Trigger download
            const link = document.createElement('a');
            link.href = data.data;
            link.download = data.filename;
            link.click();
        } catch (err) {
            console.error('Export error:', err);
            alert('Export failed. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    const exampleQueries = language === 'fr' ? [
        'Top 5 fournisseurs par montant total',
        'Évolution des dépenses par mois',
        'Factures en attente d\'approbation',
        'Montant moyen par fournisseur',
        'Distribution des statuts de factures',
    ] : [
        'Top 5 vendors by total amount',
        'Monthly spending trend',
        'Pending invoices',
        'Average amount per vendor',
        'Invoice status distribution',
    ];

    return (
        <PageContainer title={language === 'fr' ? "Insights IA" : "AI Insights"}>
            <div className="space-y-8">
                {/* Header with Language Toggle */}
                <div className="flex justify-between items-start">
                    <div className="p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl backdrop-blur-sm flex-1 mr-4">
                        <div className="flex items-start gap-3">
                            <Sparkles size={24} className="text-purple-400 mt-1 flex-shrink-0" />
                            <div>
                                <h2 className="text-white font-bold mb-2">
                                    {language === 'fr' ? 'Analyse Intelligente de Données' : 'Intelligent Data Analysis'}
                                </h2>
                                <p className="text-slate-300 text-sm">
                                    {language === 'fr'
                                        ? 'Posez une question en langage naturel sur vos données, et l\'IA génère automatiquement l\'analyse avec visualisations adaptées.'
                                        : 'Ask a question in natural language about your data, and AI automatically generates the analysis with appropriate visualizations.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Language Toggle */}
                    <button
                        onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
                        className="px-4 py-3 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl border border-white/10 transition-all flex items-center gap-2"
                    >
                        <Globe size={18} />
                        {language === 'fr' ? 'FR' : 'EN'}
                    </button>
                </div>

                {/* Query Input */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={language === 'fr'
                                ? "Ex: Top 5 fournisseurs par montant total..."
                                : "Ex: Top 5 vendors by total amount..."}
                            className="w-full bg-slate-900/50 border border-white/10 text-white text-lg rounded-xl pl-6 pr-16 py-4 focus:outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/30 transition-all placeholder:text-slate-500"
                        />
                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-[#00B4D8] hover:bg-[#00a3c4] disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg shadow-[#00B4D8]/20 flex items-center gap-2"
                        >
                            <Send size={18} />
                            {language === 'fr' ? 'Analyser' : 'Analyze'}
                        </button>
                    </div>

                    {/* Smart Suggestions */}
                    {suggestions && (
                        <div className="space-y-3">
                            {/* AI Suggestions */}
                            {suggestions.ai_suggestions && suggestions.ai_suggestions.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Lightbulb size={14} className="text-yellow-400" />
                                        <span className="text-xs text-slate-400 font-medium">
                                            {language === 'fr' ? 'Suggestions IA' : 'AI Suggestions'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {suggestions.ai_suggestions.map((suggestion: string, idx: number) => (
                                            <button
                                                key={`ai-${idx}`}
                                                type="button"
                                                onClick={() => setQuery(suggestion)}
                                                className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-slate-300 text-xs rounded-lg border border-purple-500/30 transition-colors"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Popular Queries */}
                            {suggestions.popular_queries && suggestions.popular_queries.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles size={14} className="text-teal-400" />
                                        <span className="text-xs text-slate-400 font-medium">
                                            {language === 'fr' ? 'Questions populaires' : 'Popular Questions'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {suggestions.popular_queries.map((suggestion: string, idx: number) => (
                                            <button
                                                key={`pop-${idx}`}
                                                type="button"
                                                onClick={() => setQuery(suggestion)}
                                                className="px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 text-xs rounded-lg border border-white/10 transition-colors"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Example Queries Fallback */}
                            {(!suggestions.ai_suggestions || suggestions.ai_suggestions.length === 0) &&
                                (!suggestions.popular_queries || suggestions.popular_queries.length === 0) && (
                                    <div>
                                        <span className="text-xs text-slate-500 py-2">
                                            {language === 'fr' ? 'Exemples:' : 'Examples:'}
                                        </span>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {exampleQueries.map((example, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setQuery(example)}
                                                    className="px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 text-xs rounded-lg border border-white/10 transition-colors"
                                                >
                                                    {example}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                        </div>
                    )}
                </form>

                {/* Export Buttons */}
                {result && !loading && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleExport('pdf')}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <FileText size={18} />
                            {language === 'fr' ? 'Exporter PDF' : 'Export PDF'}
                        </button>
                        <button
                            onClick={() => handleExport('excel')}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <FileSpreadsheet size={18} />
                            {language === 'fr' ? 'Exporter Excel' : 'Export Excel'}
                        </button>
                    </div>
                )}

                {/* Results */}
                <InsightsWidget result={result} loading={loading} error={error || undefined} />
            </div>
        </PageContainer>
    );
}
