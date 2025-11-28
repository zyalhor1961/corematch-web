'use client';

import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText, Database, Layers, Maximize2 } from 'lucide-react';

interface Chunk {
    id: string;
    content: string;
    chunk_type: string;
    page_number: number;
    embedding?: number[];
}

interface ChunkInspectorProps {
    invoiceId: string;
    className?: string;
    extractionData?: Record<string, any>;
    onFocusField?: (fieldName: string) => void;
}

export const ChunkInspector: React.FC<ChunkInspectorProps> = ({ invoiceId, className, extractionData, onFocusField }) => {
    const supabase = createClientComponentClient();
    const [activeTab, setActiveTab] = useState<'markdown' | 'fields'>('markdown');
    const [chunks, setChunks] = useState<Chunk[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchChunks = async () => {
            if (!invoiceId) return;

            // Fetch from new unified tables: invoice_lines and invoice_context_chunks
            const [linesResult, contextResult] = await Promise.all([
                supabase
                    .from('invoice_lines')
                    .select('id, description, quantity, unit_price, amount_ht, tax_rate, line_number')
                    .eq('invoice_id', invoiceId)
                    .order('line_number', { ascending: true }),
                supabase
                    .from('invoice_context_chunks')
                    .select('id, content, chunk_type, page_number')
                    .eq('invoice_id', invoiceId)
                    .order('page_number', { ascending: true })
            ]);

            const allChunks: Chunk[] = [];

            // Convert line items to chunks for display
            if (linesResult.data) {
                linesResult.data.forEach((line: any, idx: number) => {
                    allChunks.push({
                        id: line.id,
                        content: `**Line ${line.line_number || idx + 1}**: ${line.description}\n- Qty: ${line.quantity || 1}\n- Unit Price: ${line.unit_price || 'N/A'}\n- Amount HT: ${line.amount_ht || 'N/A'}`,
                        chunk_type: 'line_item',
                        page_number: 1
                    });
                });
            }

            // Add context chunks
            if (contextResult.data) {
                contextResult.data.forEach((chunk: any) => {
                    allChunks.push({
                        id: chunk.id,
                        content: chunk.content,
                        chunk_type: chunk.chunk_type,
                        page_number: chunk.page_number || 1
                    });
                });
            }

            if (linesResult.error) console.error('Error fetching line items:', linesResult.error);
            if (contextResult.error) console.error('Error fetching context chunks:', contextResult.error);

            setChunks(allChunks);
            setLoading(false);
        };

        fetchChunks();
    }, [invoiceId, supabase]);

    // Reconstruct full markdown document
    const fullMarkdown = chunks.map(c => c.content).join('\n\n---\n\n');

    // Helper to format field values
    const formatValue = (field: any) => {
        if (!field) return 'N/A';

        // Access the actual value property if it exists
        const val = field.value !== undefined ? field.value : field;

        if (val === null || val === undefined) return 'N/A';

        // Handle Arrays (e.g. Items)
        if (Array.isArray(val)) {
            return (
                <div className="flex flex-col gap-1 mt-1">
                    {val.map((item: any, idx: number) => {
                        // Handle both direct values and wrapped values
                        const desc = item.Description?.value || item.Description || 'Item';
                        const qty = item.Quantity?.value || item.Quantity;
                        const amtObj = item.Amount?.value || item.Amount;
                        const amt = amtObj?.amount;
                        const symbol = amtObj?.symbol || '';

                        return (
                            <div key={idx} className="text-[10px] bg-white/5 p-2 rounded border border-white/5 flex flex-col gap-1">
                                <span className="text-slate-300 font-medium">{desc}</span>
                                <div className="flex justify-between text-slate-500">
                                    <span>Qty: {qty}</span>
                                    {amt && <span className="text-emerald-400">{amt} {symbol}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // Handle Currency Object { amount: 100, symbol: '$' }
        if (typeof val === 'object' && val.amount !== undefined) {
            return `${val.amount} ${val.symbol || ''}`;
        }

        // Handle other objects (dates usually come as strings, but just in case)
        if (typeof val === 'object') {
            return JSON.stringify(val);
        }

        return String(val);
    };

    // Helper to get confidence color
    const getConfidenceColor = (conf: number) => {
        if (conf >= 0.9) return 'text-emerald-400';
        if (conf >= 0.7) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden flex flex-col h-[800px] ${className}`}>
            {/* Header / Tabs */}
            <div className="flex items-center border-b border-white/10 bg-white/5">
                <button
                    onClick={() => setActiveTab('markdown')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${activeTab === 'markdown'
                        ? 'bg-white/10 text-white border-b-2 border-[#00B4D8]'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                >
                    <FileText size={16} />
                    <span>Content</span>
                </button>
                <button
                    onClick={() => setActiveTab('fields')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${activeTab === 'fields'
                        ? 'bg-white/10 text-white border-b-2 border-[#00B4D8]'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                >
                    <Database size={16} />
                    <span>Extracted Fields</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-0 bg-[#0F172A]/80">
                {activeTab === 'markdown' ? (
                    <div className="p-4 prose prose-invert prose-sm max-w-none font-mono text-xs [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_p]:text-xs [&_li]:text-xs [&_td]:text-[10px] [&_th]:text-[10px] [&_td]:py-1 [&_th]:py-1">
                        {loading ? (
                            <div className="flex items-center justify-center h-20 text-slate-500 animate-pulse">Loading content...</div>
                        ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {fullMarkdown || '*No content available*'}
                            </ReactMarkdown>
                        )}
                    </div>
                ) : (
                    <div className="p-4 space-y-3">
                        {/* Fields List View */}
                        {!extractionData ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                                <Layers size={48} className="mb-4 opacity-20" />
                                <p>No extraction data available.</p>
                            </div>
                        ) : (
                            Object.entries(extractionData).map(([key, field]: [string, any]) => {
                                if (key === '_metadata' || !field) return null;
                                const label = key.replace(/_/g, ' ').toUpperCase();
                                const isClickable = field.box && field.box.length > 0;

                                return (
                                    <div
                                        key={key}
                                        className={`p-3 rounded-lg border transition-all group ${isClickable
                                            ? 'cursor-pointer hover:bg-white/10 border-white/5 hover:border-[#00B4D8]/30'
                                            : 'opacity-50 border-transparent'}`}
                                        onClick={() => isClickable && onFocusField && onFocusField(key)}
                                        onMouseEnter={() => isClickable && onFocusField && onFocusField(key)}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-bold text-slate-500 tracking-wider">{label}</span>
                                            {field.confidence !== undefined && (
                                                <span className={`text-[10px] font-mono ${getConfidenceColor(field.confidence)}`}>
                                                    {(field.confidence * 100).toFixed(0)}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-white font-mono break-all">
                                            {formatValue(field)}
                                        </div>
                                        {isClickable && (
                                            <div className="mt-2 flex items-center gap-1 text-[10px] text-[#00B4D8] opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Maximize2 size={10} />
                                                <span>Show in PDF</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
