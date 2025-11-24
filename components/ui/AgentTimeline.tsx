'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { CheckCircle2, Circle, AlertTriangle, Loader2, Ban, ThumbsDown, Check } from 'lucide-react';

export type AgentStep = {
    title: string;
    detail: string;
    status: 'pending' | 'processing' | 'done' | 'error' | 'warning';
};

const StatusIcon = ({ status }: { status: AgentStep['status'] }) => {
    switch (status) {
        case 'done': return <CheckCircle2 className="text-emerald-400" size={16} />;
        case 'warning': return <AlertTriangle className="text-amber-400" size={16} />;
        case 'error': return <Ban className="text-rose-400" size={16} />;
        case 'processing': return <Loader2 className="text-blue-400 animate-spin" size={16} />;
        default: return <Circle className="text-slate-600" size={16} />;
    }
};

export const AgentTimeline = ({ steps, jobId }: { steps: AgentStep[], jobId?: string | null }) => {
    const [feedbackState, setFeedbackState] = useState<Record<number, string>>({});

    const handleFeedback = async (index: number, stepTitle: string, isPositive: boolean) => {
        if (!jobId) return;
        setFeedbackState(prev => ({ ...prev, [index]: isPositive ? 'liked' : 'disliked' }));
        const { error } = await supabase.from('ai_feedback').insert({
            job_id: jobId,
            step_title: stepTitle,
            is_positive: isPositive,
            user_comment: isPositive ? "User liked this step" : "User flagged this step as incorrect"
        });
        if (error) {
            console.error('Failed to save feedback:', error);
            setFeedbackState(prev => {
                const newState = { ...prev };
                delete newState[index];
                return newState;
            });
        }
    };

    if (!steps || steps.length === 0) return <div className="text-slate-500 text-xs italic py-2">Waiting for agent...</div>;

    return (
        <div className="mt-4 space-y-0 font-sans">
            {steps.map((step, index) => (
                <div key={index} className="relative pl-6 pb-6 last:pb-0 group">
                    {index !== steps.length - 1 && (
                        <div className="absolute left-[7px] top-5 bottom-0 w-[1px] bg-white/10" />
                    )}
                    <div className="absolute left-0 top-0.5 bg-[#0F172A] z-10 ring-4 ring-[#0F172A]">
                        <StatusIcon status={step.status} />
                    </div>
                    <div className="flex justify-between items-start -mt-1">
                        <div className="flex flex-col pr-4">
                            <span className={`text-xs font-bold uppercase tracking-wider ${step.status === 'done' ? 'text-slate-200' :
                                step.status === 'warning' ? 'text-amber-300' :
                                    step.status === 'error' ? 'text-rose-300' :
                                        'text-blue-300'
                                }`}>{step.title}</span>
                            <span className="text-xs text-slate-400 mt-0.5 leading-relaxed">{step.detail}</span>
                        </div>
                        {(step.status === 'done' || step.status === 'warning') && jobId && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {feedbackState[index] ? (
                                    <span className="text-[10px] text-slate-500 flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-full">
                                        <Check size={10} /> Feedback Sent
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => handleFeedback(index, step.title, false)}
                                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded transition-colors"
                                        title="Report Error"
                                    >
                                        <ThumbsDown size={12} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
