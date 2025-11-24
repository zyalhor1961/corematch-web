'use client';

import React from 'react';
import { useInvoiceAgent } from '@/hooks/useInvoiceAgent';
import { Sparkles, Bot, AlertTriangle, CheckCircle } from 'lucide-react';
import { AgentTimeline } from '@/components/ui/AgentTimeline';

export const AgentAnalysisCard = ({ invoiceId, amount }: { invoiceId: string, amount: number }) => {
    const { status, result, logs, steps, analyzeInvoice } = useInvoiceAgent(invoiceId);

    const isWorking = status === 'pending' || status === 'processing';

    return (
        <div className="bg-[#0F172A]/60 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-2xl overflow-hidden relative">

            {/* Animated Background Gradient */}
            {isWorking && (
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-purple-500/5 animate-pulse" />
            )}

            {/* Header */}
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isWorking ? 'animate-pulse bg-purple-500/20' : 'bg-slate-800'}`}>
                        <Bot className={isWorking ? "text-purple-400" : "text-slate-400"} size={20} />
                    </div>
                    <div>
                        <h3 className="text-white font-medium">CoreMatch AI Auditor</h3>
                        <p className="text-xs text-slate-400">Agent: The Accountant</p>
                    </div>
                </div>

                {status === 'idle' && (
                    <button
                        onClick={() => analyzeInvoice(amount)}
                        className="flex items-center gap-2 bg-[#00B4D8] hover:bg-[#0096B4] text-white text-sm px-4 py-2 rounded-lg transition-all shadow-[0_0_15px_rgba(0,180,216,0.3)] hover:shadow-[0_0_25px_rgba(0,180,216,0.5)]"
                    >
                        <Sparkles size={16} />
                        Analyze
                    </button>
                )}
            </div>

            {/* Dynamic Status Display */}
            {status !== 'idle' && (
                <div className="space-y-4 relative z-10">

                    {/* The Result Badge */}
                    {status === 'completed' && result && (
                        <div className={`p-3 rounded border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500 ${result === 'APPROVED'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            }`}>
                            {result === 'APPROVED' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                            <div>
                                <span className="font-mono font-bold tracking-wider">{result}</span>
                                <p className="text-xs opacity-70 mt-0.5">
                                    {result === 'APPROVED'
                                        ? 'Invoice approved automatically'
                                        : 'CFO approval required'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* The Terminal / Logs */}
                    <div className="bg-[#020617] rounded-lg p-3 font-mono text-xs text-slate-400 max-h-64 overflow-y-auto border border-white/5">
                        <AgentTimeline steps={steps} jobId={invoiceId} />
                    </div>

                    {/* Status Indicator */}
                    {status === 'failed' && (
                        <div className="p-3 rounded border bg-red-500/10 border-red-500/30 text-red-400 flex items-center gap-2">
                            <AlertTriangle size={16} />
                            <span className="text-sm">Analysis failed. Please try again.</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
